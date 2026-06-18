-- Migration: partial_unique_cnpj_cliente
--
-- Problema: a constraint UNIQUE simples em usuario_cliente.cnpj bloqueia o
-- cadastro de um novo cliente com o mesmo CNPJ quando existe um registro
-- soft-deleted (deleted_at IS NOT NULL) com aquele CNPJ.
--
-- Solução:
--   1. Torna a coluna nullable (para poder NULLar CNPJ de registros deletados)
--   2. Remove a constraint UNIQUE global
--   3. Cria índice único PARCIAL: só aplica quando deleted_at IS NULL
--      → clientes soft-deleted não travam o CNPJ para novos cadastros

-- 1. Tornar nullable
ALTER TABLE "usuario_cliente" ALTER COLUMN "cnpj" DROP NOT NULL;

-- 2. Remover constraint única global
ALTER TABLE "usuario_cliente" DROP CONSTRAINT IF EXISTS "usuario_cliente_cnpj_key";

-- 3. Criar índice único parcial (apenas registros ativos)
CREATE UNIQUE INDEX "usuario_cliente_cnpj_ativo_idx"
  ON "usuario_cliente" ("cnpj")
  WHERE "deleted_at" IS NULL AND "cnpj" IS NOT NULL;
