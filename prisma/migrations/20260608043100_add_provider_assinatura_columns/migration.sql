-- AlterTable
ALTER TABLE "configuracao_escritorio" ADD COLUMN "provider_assinatura" "ProviderAssinatura" NOT NULL DEFAULT 'INTERNO';

-- AlterTable
ALTER TABLE "usuario_cliente" ADD COLUMN "provider_assinatura" "ProviderAssinatura" NOT NULL DEFAULT 'INTERNO';
