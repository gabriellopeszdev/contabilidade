#!/bin/bash
# =============================================================================
# update.sh — Atualização com downtime mínimo (~15s)
#
# Fluxo:
#   1. git pull (puxa o código novo)
#   2. Constrói a nova imagem enquanto o app atual ainda está servindo
#   3. Reinicia apenas o container app
#   4. Aguarda o healthcheck confirmar que o app voltou
#
# O Nginx externo (Portainer/HestiaCP) deve ter a página de erro 502
# configurada para fazer auto-refresh — veja nginx-502.conf neste repositório.
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

# [1] Puxa o código mais recente
info "[1/3] Atualizando código..."
git pull --ff-only
ok "Código atualizado."
echo ""

# [2] Constrói nova imagem (app continua servindo)
info "[2/3] Construindo nova imagem (app no ar durante o build)..."
docker compose build app
ok "Imagem construída."
echo ""

# [3] Troca o container (janela de ~15s onde Nginx serve erro 502 customizado)
info "[3/3] Reiniciando app e aguardando healthcheck..."
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
