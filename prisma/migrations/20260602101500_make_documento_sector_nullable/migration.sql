-- Permite documentos enviados pelo cliente sem setor inicial.
-- O contador classifica posteriormente.
ALTER TABLE "public"."documento_fiscal"
  ALTER COLUMN "sector" DROP NOT NULL;
