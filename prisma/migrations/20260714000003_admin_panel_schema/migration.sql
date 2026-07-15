-- Add BACKUP value to ResourceType enum
ALTER TYPE "ResourceType" ADD VALUE IF NOT EXISTS 'BACKUP';

-- Add manutencao_ativa to configuracao_sistema
ALTER TABLE "configuracao_sistema" ADD COLUMN IF NOT EXISTS "manutencao_ativa" BOOLEAN NOT NULL DEFAULT false;
