-- CreateEnum
CREATE TYPE "StatusNotaPendente" AS ENUM ('PENDENTE', 'CONFIRMADA', 'REJEITADA', 'DESCONHECIDA');

-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'NOTA_PENDENTE_CONFIRMADA';
ALTER TYPE "ActionType" ADD VALUE 'NOTA_PENDENTE_REJEITADA';
ALTER TYPE "ActionType" ADD VALUE 'NOTA_PENDENTE_DESCONHECIDA';

-- AlterEnum
ALTER TYPE "ResourceType" ADD VALUE 'NOTA_PENDENTE_SEFAZ';

-- CreateTable
CREATE TABLE "nota_pendente_sefaz" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id"      UUID NOT NULL,
    "certificado_id"  UUID NOT NULL,
    "chave_acesso"    CHAR(44) NOT NULL,
    "nsu"             VARCHAR(15) NOT NULL,
    "storage_path"    VARCHAR(1000) NOT NULL,
    "file_hash"       CHAR(64) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "status"          "StatusNotaPendente" NOT NULL DEFAULT 'PENDENTE',
    "emitente_cnpj"   VARCHAR(14) NOT NULL,
    "emitente_nome"   VARCHAR(255) NOT NULL,
    "numero"          VARCHAR(9) NOT NULL,
    "serie"           VARCHAR(3) NOT NULL,
    "data_emissao"    TIMESTAMPTZ NOT NULL,
    "valor_total"     DECIMAL(15,2) NOT NULL,
    "revisado_por_id" UUID,
    "revisado_em"     TIMESTAMPTZ,
    "documento_id"    UUID,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ NOT NULL,

    CONSTRAINT "nota_pendente_sefaz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nota_pendente_sefaz_cliente_id_file_hash_key" ON "nota_pendente_sefaz"("cliente_id", "file_hash");

-- CreateIndex
CREATE INDEX "nota_pendente_sefaz_cliente_id_status_idx" ON "nota_pendente_sefaz"("cliente_id", "status");

-- AddForeignKey
ALTER TABLE "nota_pendente_sefaz" ADD CONSTRAINT "nota_pendente_sefaz_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "usuario_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
