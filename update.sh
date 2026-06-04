#!/bin/bash
# =============================================================================
# update.sh — Atualização sem downtime
#
# Durante a reinicialização do app, o nginx_lb serve a página de carregamento
# com auto-refresh — o usuário vê um spinner de alguns segundos, não um 502.
#
# Uso: ./update.sh
# =============================================================================
set -euo pipefail

APP_PORT="${APP_PORT:-4500}"
HEALTH_URL="http://localhost:${APP_PORT}/api/health"
MAX_WAIT=120

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶${NC} $1"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
fail()  { echo -e "${RED}  ✗${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     FiscoHub — Atualização Zero-Down     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# [1] Garante que o nginx_lb esteja rodando (proxy sempre ativo)
info "[1/3] Verificando nginx_lb..."
if ! docker compose ps nginx_lb | grep -q "running\|Up"; then
  docker compose up -d nginx_lb
fi
ok "nginx_lb ativo."
echo ""

# [2] Constrói a nova imagem enquanto o app atual ainda serve
info "[2/3] Construindo nova imagem (app continua no ar)..."
docker compose build app
ok "Imagem construída."
echo ""

# [3] Reinicia apenas o app (nginx_lb permanece — serve loading.html durante ~15s)
info "[3/3] Reiniciando app e aguardando inicialização..."
docker compose up -d --no-deps app

elapsed=0
printf "       "
until curl -sf "$HEALTH_URL" > /dev/null 2>&1; do
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo ""
    fail "App não respondeu em ${MAX_WAIT}s. Verifique: docker compose logs --tail=50 app"
  fi
  printf "."
  sleep 3
  elapsed=$((elapsed + 3))
done

echo ""
ok "App disponível após ${elapsed}s."
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Atualização concluída sem downtime  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
