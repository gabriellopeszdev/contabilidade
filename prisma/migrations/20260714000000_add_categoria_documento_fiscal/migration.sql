-- AlterTable: adiciona campo categoria no documento_fiscal para filtro granular
ALTER TABLE "documento_fiscal" ADD COLUMN IF NOT EXISTS "categoria" VARCHAR(50);

-- Index para filtro por (client_id, categoria)
CREATE INDEX IF NOT EXISTS "documento_fiscal_client_id_categoria_idx" ON "documento_fiscal"("client_id", "categoria");
