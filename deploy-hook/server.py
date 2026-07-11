#!/usr/bin/env python3
"""
Webhook de deploy para o FiscoHub.
Recebe o código-fonte como tarball via HTTPS POST, extrai e reconstrói
o container app via docker compose — sem precisar de SSH do GitHub.

Roda como systemd service no host do VPS.
Logs: journalctl -u deploy-hook -f
"""
import io, os, subprocess, tarfile, logging
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET  = os.environ.get('DEPLOY_HOOK_SECRET', '')
WORKDIR = os.environ.get('DEPLOY_WORKDIR', '/root/contabilidade')
MAX_MB  = 60

# Arquivos que NUNCA devem ser sobrescritos pelo deploy automático
PRESERVE = {'.env', 'nginx/nginx.conf'}

COMPOSE = ['docker', 'compose', '-f', f'{WORKDIR}/docker-compose.yml']

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S',
)
log = logging.getLogger('deploy-hook')


def run(*cmd):
    log.info('$ %s', ' '.join(cmd))
    subprocess.run(list(cmd), check=True, cwd=WORKDIR)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silencia log padrão

    def reply(self, code, text):
        body = text.encode()
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/deploy':
            self.reply(404, 'not found')
            return

        if not SECRET or self.headers.get('Authorization') != f'Bearer {SECRET}':
            log.warning('Tentativa não autorizada de %s', self.client_address[0])
            self.reply(401, 'unauthorized')
            return

        length = int(self.headers.get('Content-Length', 0))
        if length <= 0 or length > MAX_MB * 1024 * 1024:
            self.reply(400, f'tamanho inválido: {length}')
            return

        log.info('Deploy iniciado — %.1f MB recebidos', length / 1024 / 1024)

        # Extrai tarball
        try:
            data = self.rfile.read(length)
            with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
                members = [
                    m for m in tar.getmembers()
                    if not m.name.startswith('/')
                    and '..' not in m.name
                    and m.name not in PRESERVE
                ]
                tar.extractall(WORKDIR, members=members)
            log.info('%d arquivos extraídos', len(members))
        except Exception as exc:
            log.error('Falha ao extrair: %s', exc)
            self.reply(500, f'extract error: {exc}')
            return

        # Rebuild + migrations + cleanup
        try:
            run(*COMPOSE, 'up', '-d', '--build', '--no-deps', 'app')
            run(*COMPOSE, 'exec', '-T', 'app', 'npx', 'prisma', 'migrate', 'deploy')
            run('docker', 'image', 'prune', '-f')
            log.info('Deploy concluído')
            self.reply(200, 'ok')
        except subprocess.CalledProcessError as exc:
            log.error('Falha no deploy: %s', exc)
            self.reply(500, 'deploy error')


if __name__ == '__main__':
    port = int(os.environ.get('DEPLOY_HOOK_PORT', 9001))
    if not SECRET:
        log.error('DEPLOY_HOOK_SECRET não definido — encerrando')
        raise SystemExit(1)
    log.info('Escutando em 127.0.0.1:%d', port)
    HTTPServer(('127.0.0.1', port), Handler).serve_forever()
