-- Migration: chat_room_per_member
-- Cada cliente passa a ter uma sala por membro do escritório (contador + funcionários).
-- Salas existentes são migradas para membro = contador principal do cliente.

-- 1. Cria o enum
CREATE TYPE "MemberType" AS ENUM ('CONTADOR', 'FUNCIONARIO');

-- 2. Adiciona as novas colunas como nullable para permitir a migração dos dados
ALTER TABLE "chat_room" ADD COLUMN "member_id" UUID;
ALTER TABLE "chat_room" ADD COLUMN "member_type" "MemberType";

-- 3. Migra salas existentes: associa ao contador principal do cliente
UPDATE "chat_room" cr
SET
  "member_id"   = cc."contador_id",
  "member_type" = 'CONTADOR'::"MemberType"
FROM "contador_cliente" cc
WHERE cc."cliente_id" = cr."cliente_id";

-- 4. Remove salas órfãs (sem vínculo contador↔cliente — não deveriam existir)
DELETE FROM "chat_room" WHERE "member_id" IS NULL;

-- 5. Torna as colunas NOT NULL
ALTER TABLE "chat_room" ALTER COLUMN "member_id"   SET NOT NULL;
ALTER TABLE "chat_room" ALTER COLUMN "member_type" SET NOT NULL;

-- 6. Remove o antigo índice UNIQUE em cliente_id (Prisma cria como índice, não constraint)
DROP INDEX IF EXISTS "chat_room_cliente_id_key";

-- 7. Adiciona a nova constraint UNIQUE composta
ALTER TABLE "chat_room" ADD CONSTRAINT "chat_room_cliente_id_member_id_key" UNIQUE ("cliente_id", "member_id");

-- 8. Índice em member_id
CREATE INDEX "chat_room_member_id_idx" ON "chat_room"("member_id");
