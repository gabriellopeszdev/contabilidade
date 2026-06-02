#!/bin/sh
set -e

echo ">>> Rodando migrations do banco..."
npx prisma migrate deploy

echo ">>> Iniciando servidor..."
exec npm start
