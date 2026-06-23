#!/bin/sh
set -e

# Carrega segredos de arquivos montados — evita interpolação do Docker Compose
# para valores que começam com '$' (como chaves Asaas que iniciam com $aact_prod_).
if [ -f "/run/secrets/asaas_saas_api_key" ]; then
  ASAAS_SAAS_API_KEY=$(cat /run/secrets/asaas_saas_api_key)
  export ASAAS_SAAS_API_KEY
fi

echo ">>> Rodando migrations do banco..."
npx prisma migrate deploy

echo ">>> Iniciando servidor..."
exec npm start
