-- AlterEnum
ALTER TYPE "ProviderAssinatura" ADD VALUE 'SIGNATUREAPI';

-- AlterTable
ALTER TABLE "assinatura_documento" ADD COLUMN     "signatureapi_envelope_id" VARCHAR(255);
