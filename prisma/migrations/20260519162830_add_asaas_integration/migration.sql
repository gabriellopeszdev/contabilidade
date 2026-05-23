-- AlterTable
ALTER TABLE "boleto_honorario" ADD COLUMN     "asaas_barcode" VARCHAR(200),
ADD COLUMN     "asaas_boleto_url" VARCHAR(500),
ADD COLUMN     "asaas_id" VARCHAR(100),
ADD COLUMN     "asaas_pix_copia_e_cola" TEXT,
ALTER COLUMN "storage_path" DROP NOT NULL,
ALTER COLUMN "file_name" DROP NOT NULL,
ALTER COLUMN "file_size_bytes" DROP NOT NULL;

-- AlterTable
ALTER TABLE "configuracao_escritorio" ADD COLUMN     "asaas_api_key" VARCHAR(500);

-- CreateIndex
CREATE INDEX "boleto_honorario_asaas_id_idx" ON "boleto_honorario"("asaas_id");
