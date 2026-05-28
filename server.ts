/**
 * server.ts — Servidor customizado do Sistema de FiscoHub
 *
 * RESPONSABILIDADES:
 *   1. Carrega as variáveis de ambiente (.env) antes de qualquer módulo
 *      de infraestrutura ser inicializado
 *   2. Instancia um http.Server nativo do Node.js
 *   3. Delega todas as requisições HTTP ao handler do Next.js (App Router)
 *   4. Injeta esse mesmo http.Server no SocketServer, que registra
 *      o Socket.IO no caminho /api/ws sobre a mesma porta (3000)
 *
 * POR QUE UM SERVIDOR CUSTOMIZADO?
 *   O servidor embutido do Next.js não expõe o http.Server subjacente,
 *   impossibilitando a integração com Socket.IO. Com o servidor customizado,
 *   temos controle total sobre o objeto http.Server antes do listen().
 *
 * POR QUE loadEnvConfig + DYNAMIC IMPORT?
 *   Static imports (import ... from '...') são hoisted pelo runtime ES Module:
 *   eles são avaliados ANTES de qualquer linha do corpo do módulo rodar.
 *   Container.ts cria conexões Redis/Prisma/MinIO no nível do módulo (fora
 *   de funções), lendo process.env na inicialização. Se fosse um static import,
 *   ele rodaria antes de loadEnvConfig() — e REDIS_PASSWORD chegaria undefined.
 *
 *   Solução: Container.ts é importado com await import() dentro do callback
 *   assíncrono, garantindo que loadEnvConfig() já rodou e process.env está
 *   completo quando o módulo é avaliado pela primeira vez.
 *
 *   SocketServer.ts é seguro como static import: ele não lê process.env no
 *   nível do módulo — apenas em construtores chamados dentro do .then().
 *
 * EXECUÇÃO:
 *   dev:   npm run dev    → tsx watch server.ts  (hot-reload via tsx)
 *   prod:  npm run build  → next build
 *          npm start      → tsx server.ts  (NODE_ENV=production)
 */

// =============================================================================
// PASSO 1 — Importações sem efeitos colaterais dependentes de process.env
// =============================================================================

import { loadEnvConfig } from '@next/env';
import { createServer }  from 'node:http';
import { parse }         from 'node:url';

import next from 'next';

import { SocketServer }        from './src/infrastructure/websockets/SocketServer';
import { PinoLogger }          from './src/infrastructure/logger/PinoLogger';
import { withRequestLogging }  from './src/infrastructure/http/middlewares/withRequestLogging';

// =============================================================================
// PASSO 2 — Carregamento do .env ANTES de qualquer infraestrutura
//
// loadEnvConfig lê: .env, .env.local, .env.development / .env.production
// (mesma lógica usada internamente pelo Next.js no next dev / next start).
// Deve ser chamado aqui, no corpo do módulo, antes dos dynamic imports abaixo.
// =============================================================================

loadEnvConfig(process.cwd());

// =============================================================================
// PASSO 3 — Configuração (process.env já populado)
// =============================================================================

const dev      = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST ?? '0.0.0.0';
const port     = parseInt(process.env.PORT ?? '3000', 10);

// Logger de fallback: instanciado diretamente (não depende de Redis/Prisma/MinIO).
// Usado apenas se o Container falhar ao carregar (erro de configuração grave).
const fallbackLogger = new PinoLogger();

// =============================================================================
// PASSO 4 — Inicialização do Next.js
// =============================================================================

const app     = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {

  // ---------------------------------------------------------------------------
  // PASSO 5 — Dynamic import do Container
  //
  // Container.ts é avaliado AQUI, após loadEnvConfig() ter rodado.
  // Redis, Prisma e MinIO recebem as credenciais corretas do process.env.
  // ---------------------------------------------------------------------------

  const { logger, prisma, emailService } = await import('./src/infrastructure/di/Container');
  const { BullMQAdapter } = await import('./src/infrastructure/queue/BullMQAdapter');

  // ---------------------------------------------------------------------------
  // Servidor HTTP — todas as requisições são passadas ao handler do Next.js
  // ---------------------------------------------------------------------------

  // Envolve o handler do Next.js com logging HTTP estruturado + RequestContext
  const loggingHandler = withRequestLogging(handler, logger);

  const httpServer = createServer((req, res) => {
    // parse(url, true) → querystring como objeto (necessário para o router)
    const parsedUrl = parse(req.url ?? '/', true);
    loggingHandler(req, res, parsedUrl);
  });

  // ---------------------------------------------------------------------------
  // SocketServer — Socket.IO escuta no mesmo httpServer, path /api/ws
  //
  // A configuração Redis é lida das variáveis de ambiente, permitindo
  // usar o docker-compose.yml sem nenhuma alteração no código.
  // ---------------------------------------------------------------------------

  const redisConn = {
    host:     process.env.REDIS_HOST     ?? 'localhost',
    port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
  };

  const socketServer = new SocketServer(httpServer, redisConn, logger, prisma);

  // BullMQ — filas de processamento em background + jobs agendados
  const bullMQ = new BullMQAdapter(redisConn, logger, prisma, emailService);
  bullMQ.iniciarWorker(2);
  await bullMQ.agendarLembreteBoleto();
  await bullMQ.agendarJobsObrigacoes();

  // ---------------------------------------------------------------------------
  // Listen
  // ---------------------------------------------------------------------------

  httpServer.listen(port, hostname, () => {
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    logger.info('Servidor pronto', {
      url:       `http://${displayHost}:${port}`,
      modo:      dev ? 'desenvolvimento' : 'produção',
      websocket: `ws://${displayHost}:${port}/api/ws`,
    });
  });

  // ---------------------------------------------------------------------------
  // Encerramento gracioso
  //
  // SIGTERM → orquestrador (Docker, PM2, systemd) solicita encerramento
  // SIGINT  → Ctrl+C no terminal em desenvolvimento
  //
  // Sequência:
  //   1. Fecha o SocketServer: desconecta todos os sockets e o subscriber Redis
  //   2. Fecha o httpServer: rejeita novas conexões, aguarda as ativas
  //   3. process.exit(0)
  // ---------------------------------------------------------------------------

  const encerrar = async (sinal: string) => {
    logger.info('Iniciando encerramento gracioso.', { sinal });

    try {
      await socketServer.fechar();
    } catch (err) {
      logger.error('[server] Erro ao fechar SocketServer', err instanceof Error ? err : { err });
    }

    try {
      await bullMQ.fechar();
    } catch (err) {
      logger.error('[server] Erro ao fechar BullMQ', err instanceof Error ? err : { err });
    }

    httpServer.close((err) => {
      if (err) {
        logger.error('[server] Erro ao fechar HTTP server', err);
        process.exit(1);
      }
      logger.info('[server] Encerrado com sucesso.');
      process.exit(0);
    });

    // Força saída após 10s se alguma conexão não encerrar
    setTimeout(() => {
      logger.fatal('[server] Timeout — forçando encerramento.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT',  () => encerrar('SIGINT'));

}).catch((err: unknown) => {
  // Container pode não ter sido importado ainda — usa o logger de fallback.
  fallbackLogger.fatal('[server] Falha ao preparar Next.js', err instanceof Error ? err : { err });
  process.exit(1);
});
