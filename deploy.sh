#!/bin/bash
# =============================================================================
# deploy.sh — Script de deploy para VPS Hostinger (Ubuntu)
#
# Execute na raiz do projeto, no servidor:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Pré-requisitos no servidor:
#   - Docker e Docker Compose instalados
#   - Domínio apontando para o IP do servidor (DNS propagado)
#   - Arquivo .env preenchido (cp .env.example .env && nano .env)
# =============================================================================

set -e

# --- Cores para output ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# =============================================================================
# Verifica pré-requisitos
# =============================================================================
command -v docker  >/dev/null 2>&1 || error "Docker não encontrado. Instale com: curl -fsSL https://get.docker.com | sh"
command -v openssl >/dev/null 2>&1 || error "openssl não encontrado."
[ -f .env ] || error "Arquivo .env não encontrado. Execute: cp .env.example .env && nano .env"

# Carrega variáveis do .env
source .env

[ -z "$JWT_SECRET" ] && error "JWT_SECRET não definido no .env"
[ -z "$POSTGRES_PASSWORD" ] && error "POSTGRES_PASSWORD não definido no .env"
[ -z "$NEXT_PUBLIC_APP_URL" ] && error "NEXT_PUBLIC_APP_URL não definido no .env (ex: https://seudominio.com)"

# Extrai o domínio da URL
DOMAIN=$(echo "$NEXT_PUBLIC_APP_URL" | sed 's|https\?://||' | sed 's|/.*||')
info "Domínio detectado: $DOMAIN"

# =============================================================================
# 1. Cria diretórios de dados
# =============================================================================
info "Criando diretórios de dados..."
mkdir -p "${DATA_DIR:-./.data}/postgres"
mkdir -p "${DATA_DIR:-./.data}/redis"
mkdir -p "${DATA_DIR:-./.data}/minio"
mkdir -p "${DATA_DIR:-./.data}/certbot/conf"
mkdir -p "${DATA_DIR:-./.data}/certbot/www"

# =============================================================================
# 2. Substitui o domínio no nginx.conf
# =============================================================================
info "Configurando nginx para o domínio: $DOMAIN"
sed -i "s/SEU_DOMINIO.com/$DOMAIN/g" nginx/nginx.conf

# =============================================================================
# 3. Sobe a infraestrutura (sem o app — aguarda SSL)
# =============================================================================
info "Subindo PostgreSQL, Redis e MinIO..."
docker compose up -d postgres redis minio minio_init

info "Aguardando serviços ficarem saudáveis..."
sleep 15

# =============================================================================
# 4. Nginx temporário só para HTTP (validação do Certbot)
# =============================================================================
info "Subindo nginx temporário para validação ACME..."

# Cria config temporária só com HTTP (sem bloco HTTPS — cert ainda não existe)
cat > /tmp/nginx_http_only.conf << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 200 'aguardando SSL...';
        add_header Content-Type text/plain;
    }
}
EOF

docker run -d --name nginx_temp \
  --network contabilidade_net \
  -p 80:80 \
  -v /tmp/nginx_http_only.conf:/etc/nginx/conf.d/default.conf:ro \
  -v "${DATA_DIR:-./.data}/certbot/www:/var/www/certbot:ro" \
  nginx:alpine

sleep 3

# =============================================================================
# 5. Obtém certificado SSL via Certbot
# =============================================================================
info "Obtendo certificado SSL para $DOMAIN..."

EMAIL=""
while [ -z "$EMAIL" ]; do
  read -p "  → Digite seu e-mail para o certificado SSL (Let's Encrypt): " EMAIL
done

docker run --rm \
  -v "${DATA_DIR:-./.data}/certbot/conf:/etc/letsencrypt" \
  -v "${DATA_DIR:-./.data}/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# Para e remove o nginx temporário
docker stop nginx_temp && docker rm nginx_temp

# =============================================================================
# 6. Build e sobe a aplicação completa
# =============================================================================
info "Fazendo build da aplicação..."
docker compose build app

info "Subindo aplicação e nginx..."
docker compose up -d app nginx

info "Aguardando app inicializar..."
sleep 20

# =============================================================================
# 7. Migrações e seed do banco
# =============================================================================
info "Executando migrações do banco de dados..."
docker compose exec app npx prisma migrate deploy

info "Executando seed (cria admin inicial)..."
docker compose exec app npm run db:seed

# =============================================================================
# 8. Configura renovação automática do certificado SSL
# =============================================================================
info "Configurando renovação automática do SSL (cron)..."
RENEW_CMD="docker run --rm -v ${DATA_DIR:-./.data}/certbot/conf:/etc/letsencrypt -v ${DATA_DIR:-./.data}/certbot/www:/var/www/certbot certbot/certbot renew --quiet && docker compose -f $(pwd)/docker-compose.yml exec nginx nginx -s reload"
(crontab -l 2>/dev/null; echo "0 3 * * * $RENEW_CMD") | crontab -

# =============================================================================
# Resumo final
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo ""
echo "  URL: https://$DOMAIN"
echo ""
echo "  Credenciais de acesso inicial:"
echo "    Super Admin → superadmin@contabilidade.com / superadmin123"
echo "    Contador    → contador@contabilidade.com   / contador123"
echo "    Cliente     → cliente@empresa.com          / cliente123"
echo ""
echo -e "  ${RED}⚠️  TROQUE AS SENHAS ACIMA APÓS O PRIMEIRO LOGIN!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
