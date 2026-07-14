-- Migration: Substituir DocSeal e SignatureAPI por ZapSign
--
-- Estratégia para alterar enum no PostgreSQL:
--   1. Converter linhas existentes com DOCSEAL/SIGNATUREAPI para INTERNO
--   2. Renomear o tipo antigo
--   3. Criar o novo tipo com apenas INTERNO e ZAPSIGN
--   4. Alterar colunas para usar o novo tipo (USING cast)
--   5. Dropar o tipo antigo
--   6. Adicionar coluna zapsign_doc_token
--   7. Remover colunas docseal_submission_id e signatureapi_envelope_id

-- Passo 1: Converter valores obsoletos nas três tabelas que usam o enum
UPDATE "assinatura_documento"
SET provider_assinatura = 'INTERNO'
WHERE provider_assinatura IN ('DOCSEAL', 'SIGNATUREAPI');

UPDATE "usuario_cliente"
SET provider_assinatura = 'INTERNO'
WHERE provider_assinatura IN ('DOCSEAL', 'SIGNATUREAPI');

UPDATE "configuracao_escritorio"
SET provider_assinatura = 'INTERNO'
WHERE provider_assinatura IN ('DOCSEAL', 'SIGNATUREAPI');

-- Passo 2: Renomear o tipo antigo
ALTER TYPE "ProviderAssinatura" RENAME TO "ProviderAssinatura_old";

-- Passo 3: Criar o novo tipo com os valores corretos
CREATE TYPE "ProviderAssinatura" AS ENUM ('INTERNO', 'ZAPSIGN');

-- Passo 4: Alterar as colunas para usar o novo tipo

ALTER TABLE "assinatura_documento"
  ALTER COLUMN "provider_assinatura" DROP DEFAULT;
ALTER TABLE "assinatura_documento"
  ALTER COLUMN "provider_assinatura"
  TYPE "ProviderAssinatura"
  USING "provider_assinatura"::text::"ProviderAssinatura";
ALTER TABLE "assinatura_documento"
  ALTER COLUMN "provider_assinatura" SET DEFAULT 'INTERNO'::"ProviderAssinatura";

ALTER TABLE "usuario_cliente"
  ALTER COLUMN "provider_assinatura" DROP DEFAULT;
ALTER TABLE "usuario_cliente"
  ALTER COLUMN "provider_assinatura"
  TYPE "ProviderAssinatura"
  USING "provider_assinatura"::text::"ProviderAssinatura";
ALTER TABLE "usuario_cliente"
  ALTER COLUMN "provider_assinatura" SET DEFAULT 'INTERNO'::"ProviderAssinatura";

ALTER TABLE "configuracao_escritorio"
  ALTER COLUMN "provider_assinatura" DROP DEFAULT;
ALTER TABLE "configuracao_escritorio"
  ALTER COLUMN "provider_assinatura"
  TYPE "ProviderAssinatura"
  USING "provider_assinatura"::text::"ProviderAssinatura";
ALTER TABLE "configuracao_escritorio"
  ALTER COLUMN "provider_assinatura" SET DEFAULT 'INTERNO'::"ProviderAssinatura";

-- Passo 5: Dropar o tipo antigo
DROP TYPE "ProviderAssinatura_old";

-- Passo 6: Adicionar coluna zapsign_doc_token
ALTER TABLE "assinatura_documento"
  ADD COLUMN IF NOT EXISTS "zapsign_doc_token" VARCHAR(255);

-- Passo 7: Remover colunas antigas
ALTER TABLE "assinatura_documento"
  DROP COLUMN IF EXISTS "docseal_submission_id";

ALTER TABLE "assinatura_documento"
  DROP COLUMN IF EXISTS "signatureapi_envelope_id";
