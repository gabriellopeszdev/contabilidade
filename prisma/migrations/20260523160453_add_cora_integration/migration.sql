-- AlterTable
ALTER TABLE "boleto_honorario" ADD COLUMN     "cora_barcode" VARCHAR(300),
ADD COLUMN     "cora_boleto_url" VARCHAR(500),
ADD COLUMN     "cora_id" VARCHAR(100),
ADD COLUMN     "cora_pix_payload" TEXT;

-- AlterTable
ALTER TABLE "configuracao_escritorio" ADD COLUMN     "cora_certificate_pem" TEXT,
ADD COLUMN     "cora_client_id" VARCHAR(200),
ADD COLUMN     "cora_private_key_pem" TEXT;

-- CreateIndex
CREATE INDEX "boleto_honorario_cora_id_idx" ON "boleto_honorario"("cora_id");
