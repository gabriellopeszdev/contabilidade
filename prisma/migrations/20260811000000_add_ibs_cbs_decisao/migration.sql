-- CreateEnum
CREATE TYPE "StatusIbsCbs" AS ENUM ('PENDENTE', 'DENTRO_DAS', 'FORA_DAS', 'NAO_SE_APLICA');

-- AlterTable
ALTER TABLE "usuario_cliente"
  ADD COLUMN "ibs_cbs_status" "StatusIbsCbs" NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN "ibs_cbs_decidido_em" TIMESTAMPTZ,
  ADD COLUMN "ibs_cbs_observacao" VARCHAR(500);

CREATE INDEX "usuario_cliente_ibs_cbs_status_idx" ON "usuario_cliente"("ibs_cbs_status");
