-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('BOLETO', 'PIX', 'INDEFINIDO');

-- AlterTable
ALTER TABLE "boleto_honorario" ADD COLUMN     "asaas_subscription_id" VARCHAR(100),
ADD COLUMN     "tipo_pagamento" "TipoPagamento" NOT NULL DEFAULT 'BOLETO';

-- CreateTable
CREATE TABLE "assinatura_honorario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "escritorio_id" UUID NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "ciclo" VARCHAR(20) NOT NULL,
    "tipo_pagamento" "TipoPagamento" NOT NULL DEFAULT 'BOLETO',
    "descricao" VARCHAR(500),
    "asaas_id" VARCHAR(100),
    "asaas_status" VARCHAR(30),
    "proximo_vencimento" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assinatura_honorario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_honorario_asaas_id_key" ON "assinatura_honorario"("asaas_id");

-- CreateIndex
CREATE INDEX "assinatura_honorario_cliente_id_idx" ON "assinatura_honorario"("cliente_id");

-- CreateIndex
CREATE INDEX "assinatura_honorario_escritorio_id_idx" ON "assinatura_honorario"("escritorio_id");

-- CreateIndex
CREATE INDEX "assinatura_honorario_asaas_id_idx" ON "assinatura_honorario"("asaas_id");

-- AddForeignKey
ALTER TABLE "assinatura_honorario" ADD CONSTRAINT "assinatura_honorario_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_honorario" ADD CONSTRAINT "assinatura_honorario_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "usuario_contador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
