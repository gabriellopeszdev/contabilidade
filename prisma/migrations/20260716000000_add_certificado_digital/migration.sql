-- CreateEnum
CREATE TYPE "StatusCertificado" AS ENUM ('ATIVO', 'EXPIRADO', 'INVALIDO', 'REVOGADO');

-- AlterEnum: add certificado action types
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'CERTIFICADO_CADASTRADO';
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'CERTIFICADO_REMOVIDO';

-- CreateTable
CREATE TABLE "certificado_digital" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "arquivo_cifrado" TEXT NOT NULL,
    "senha_cifrada" TEXT NOT NULL,
    "cnpj_titular" CHAR(14) NOT NULL,
    "validade" TIMESTAMPTZ NOT NULL,
    "ultimo_nsu" VARCHAR(15) NOT NULL DEFAULT '000000000000000',
    "status" "StatusCertificado" NOT NULL DEFAULT 'ATIVO',
    "ultima_consulta_em" TIMESTAMPTZ,
    "criado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "certificado_digital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificado_digital_client_id_key" ON "certificado_digital"("client_id");

-- AddForeignKey
ALTER TABLE "certificado_digital" ADD CONSTRAINT "certificado_digital_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "usuario_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
