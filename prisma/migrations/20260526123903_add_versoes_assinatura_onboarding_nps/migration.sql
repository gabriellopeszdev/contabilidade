-- CreateEnum
CREATE TYPE "StatusAssinaturaDoc" AS ENUM ('PENDENTE', 'ASSINADO', 'RECUSADO', 'EXPIRADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'ASSINATURA_SOLICITADA';
ALTER TYPE "ActionType" ADD VALUE 'ASSINATURA_CONCLUIDA';
ALTER TYPE "ActionType" ADD VALUE 'ASSINATURA_RECUSADA';

-- AlterTable
ALTER TABLE "documento_fiscal" ADD COLUMN     "versao_atual" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "usuario_contador" ADD COLUMN     "onboarding_concluido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_passos" TEXT[],
ADD COLUMN     "primeiro_login_em" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "documento_versao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documento_id" UUID NOT NULL,
    "versao" INTEGER NOT NULL,
    "storage_path" VARCHAR(1000) NOT NULL,
    "file_hash" CHAR(64) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "motivo" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_versao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinatura_documento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documento_id" UUID NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "signatario_id" UUID NOT NULL,
    "signatario_email" VARCHAR(255) NOT NULL,
    "signatario_nome" VARCHAR(255) NOT NULL,
    "status" "StatusAssinaturaDoc" NOT NULL DEFAULT 'PENDENTE',
    "token_assinatura" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "assinado_at" TIMESTAMPTZ,
    "ip_assinatura" VARCHAR(45),
    "hash_documento" CHAR(64) NOT NULL,
    "comprovante_storage_path" VARCHAR(1000),
    "motivo_recusa" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assinatura_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nps_response" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "user_type" VARCHAR(20) NOT NULL,
    "score" INTEGER NOT NULL,
    "comentario" VARCHAR(1000),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nps_response_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documento_versao_documento_id_idx" ON "documento_versao"("documento_id");

-- CreateIndex
CREATE UNIQUE INDEX "documento_versao_documento_id_versao_key" ON "documento_versao"("documento_id", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_documento_token_assinatura_key" ON "assinatura_documento"("token_assinatura");

-- CreateIndex
CREATE INDEX "assinatura_documento_documento_id_idx" ON "assinatura_documento"("documento_id");

-- CreateIndex
CREATE INDEX "assinatura_documento_signatario_id_idx" ON "assinatura_documento"("signatario_id");

-- CreateIndex
CREATE INDEX "assinatura_documento_token_assinatura_idx" ON "assinatura_documento"("token_assinatura");

-- CreateIndex
CREATE INDEX "assinatura_documento_status_expires_at_idx" ON "assinatura_documento"("status", "expires_at");

-- CreateIndex
CREATE INDEX "nps_response_user_id_idx" ON "nps_response"("user_id");

-- CreateIndex
CREATE INDEX "nps_response_created_at_idx" ON "nps_response"("created_at");

-- AddForeignKey
ALTER TABLE "documento_versao" ADD CONSTRAINT "documento_versao_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento_fiscal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_documento" ADD CONSTRAINT "assinatura_documento_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento_fiscal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
