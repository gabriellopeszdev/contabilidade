-- Migration: encrypt_cora_keys
--
-- Esta migration apenas documenta a mudança de responsabilidade:
-- os campos coraCertificatePem e coraPrivateKeyPem continuam como TEXT,
-- mas a aplicação agora cifra o conteúdo antes de persistir.
-- Não há alteração de schema — a criptografia é transparente na camada
-- de aplicação (src/utils/encryption.ts).
--
-- Para migrar dados existentes (se houver), rode o script:
--   npx ts-node scripts/migrate-cora-keys.ts
-- (ou execute manualmente pelo painel admin ao reconfigurar as integrações)

-- Sem DDL necessário: colunas permanecem TEXT.
SELECT 1; -- no-op para satisfazer o runner do Prisma
