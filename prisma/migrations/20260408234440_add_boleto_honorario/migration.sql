-- CreateEnum
CREATE TYPE "StatusBoleto" AS ENUM ('PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "boleto_honorario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "escritorio_id" UUID NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusBoleto" NOT NULL DEFAULT 'PENDENTE',
    "mes_referencia" VARCHAR(7) NOT NULL,
    "storage_path" VARCHAR(1000) NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "descricao" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "boleto_honorario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boleto_honorario_cliente_id_status_idx" ON "boleto_honorario"("cliente_id", "status");

-- CreateIndex
CREATE INDEX "boleto_honorario_cliente_id_vencimento_idx" ON "boleto_honorario"("cliente_id", "vencimento");

-- CreateIndex
CREATE INDEX "boleto_honorario_escritorio_id_mes_referencia_idx" ON "boleto_honorario"("escritorio_id", "mes_referencia");

-- CreateIndex
CREATE INDEX "boleto_honorario_escritorio_id_status_idx" ON "boleto_honorario"("escritorio_id", "status");

-- AddForeignKey
ALTER TABLE "boleto_honorario" ADD CONSTRAINT "boleto_honorario_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleto_honorario" ADD CONSTRAINT "boleto_honorario_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "usuario_contador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
