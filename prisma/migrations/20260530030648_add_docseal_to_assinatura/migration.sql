-- CreateEnum
CREATE TYPE "ProviderAssinatura" AS ENUM ('INTERNO', 'DOCSEAL');

-- AlterTable
ALTER TABLE "assinatura_documento" ADD COLUMN     "docseal_submission_id" INTEGER,
ADD COLUMN     "link_externo" VARCHAR(1000),
ADD COLUMN     "provider" "ProviderAssinatura" NOT NULL DEFAULT 'INTERNO';
