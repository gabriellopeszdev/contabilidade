-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'ESTORNO_SOLICITADO';
ALTER TYPE "ActionType" ADD VALUE 'ASSINATURA_CANCELADA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ResourceType" ADD VALUE 'BOLETO';
ALTER TYPE "ResourceType" ADD VALUE 'ASSINATURA';

-- CreateTable
CREATE TABLE "webhook_event_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_key" VARCHAR(200) NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_log_event_key_key" ON "webhook_event_log"("event_key");
