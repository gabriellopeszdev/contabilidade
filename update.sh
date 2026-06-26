#!/bin/bash
# =============================================================================
# update.sh — Atualização manual no VPS (sem git pull)
#
# Use quando precisar reconstruir o app sem fazer novo commit/push.
# O deploy automático via GitHub Actions já executa isso sozinho.
#
# Uso: ./update.sh
# =============================================================================
set -euo pipefail

APP_PORT="${APP_PORT:-4500}"
HEALTH_URL="http://localhost:${APP_PORT}/api/health"
MAX_WAIT=120

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶${NC} $1"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
fail()  { echo -e "${RED}  ✗${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       FiscoHub — Atualização             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# [1] Reconstrói a imagem (app continua servindo durante o build)
info "[1/2] Construindo nova imagem (app no ar durante o build)..."
docker compose build app
ok "Imagem construída."
echo ""

# [2] Troca o container (janela de ~15s onde Nginx serve erro 502 customizado)
info "[2/2] Reiniciando app e aguardando healthcheck..."
docker compose up -d --no-deps app

elapsed=0
printf "       "
until curl -sf "$HEALTH_URL" > /dev/null 2>&1; do
  if [ "$elapsed" -ge "$MAX_WAIT" ]; then
    echo ""
    fail "App não respondeu em ${MAX_WAIT}s. Logs: docker compose logs --tail=50 app"
  fi
  printf "."
  sleep 3
  elapsed=$((elapsed + 3))
done

echo ""
ok "App disponível (${elapsed}s de reinicialização)."
echo ""
echo -e "${GREEN}  Atualização concluída!${NC}"
echo ""
