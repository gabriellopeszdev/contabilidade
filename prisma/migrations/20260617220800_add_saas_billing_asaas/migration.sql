-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "FileType" ADD VALUE 'XLSX';
ALTER TYPE "FileType" ADD VALUE 'XLS';
ALTER TYPE "FileType" ADD VALUE 'DOCX';
ALTER TYPE "FileType" ADD VALUE 'DOC';
ALTER TYPE "FileType" ADD VALUE 'CSV';
ALTER TYPE "FileType" ADD VALUE 'OFX';
ALTER TYPE "FileType" ADD VALUE 'ODS';

-- AlterTable
ALTER TABLE "assinatura_saas" ADD COLUMN     "asaas_customer_id" VARCHAR(100),
ADD COLUMN     "asaas_subscription_id" VARCHAR(100),
ADD COLUMN     "billing_type" VARCHAR(20) NOT NULL DEFAULT 'UNDEFINED';

-- CreateTable
CREATE TABLE "cobranca_saas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assinatura_id" UUID NOT NULL,
    "escritorio_id" UUID NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "mes_referencia" VARCHAR(7) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "asaas_payment_id" VARCHAR(100),
    "asaas_boleto_url" VARCHAR(500),
    "asaas_invoice_url" VARCHAR(500),
    "asaas_pix_payload" TEXT,
    "asaas_barcode" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cobranca_saas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cobranca_saas_asaas_payment_id_key" ON "cobranca_saas"("asaas_payment_id");

-- CreateIndex
CREATE INDEX "cobranca_saas_escritorio_id_status_idx" ON "cobranca_saas"("escritorio_id", "status");

-- CreateIndex
CREATE INDEX "cobranca_saas_asaas_payment_id_idx" ON "cobranca_saas"("asaas_payment_id");

-- CreateIndex
CREATE INDEX "cobranca_saas_assinatura_id_idx" ON "cobranca_saas"("assinatura_id");

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_saas_asaas_customer_id_key" ON "assinatura_saas"("asaas_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_saas_asaas_subscription_id_key" ON "assinatura_saas"("asaas_subscription_id");

-- AddForeignKey
ALTER TABLE "cobranca_saas" ADD CONSTRAINT "cobranca_saas_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinatura_saas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobranca_saas" ADD CONSTRAINT "cobranca_saas_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "usuario_contador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
