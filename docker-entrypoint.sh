#!/bin/sh
set -e

# Reconstrói ASAAS_SAAS_API_KEY a partir do corpo sem '$'.
# Docker Compose v5 não consegue passar valores que começam com '$' sem corromper
# via interpolação. Solução: .env guarda a parte após o '$' em ASAAS_SAAS_API_KEY_BODY.
if [ -n "${ASAAS_SAAS_API_KEY_BODY:-}" ]; then
  ASAAS_SAAS_API_KEY="\$${ASAAS_SAAS_API_KEY_BODY}"
  export ASAAS_SAAS_API_KEY
fi

echo ">>> Rodando migrations do banco..."
npx prisma migrate deploy

echo ">>> Iniciando servidor..."
exec npm start
