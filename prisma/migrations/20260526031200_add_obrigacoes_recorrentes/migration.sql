-- CreateEnum
CREATE TYPE "RecorrenciaTipo" AS ENUM ('MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- AlterTable
ALTER TABLE "obrigacao_fiscal" ADD COLUMN     "lembrete_antecedencia" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "lembrete_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lembrete_notificacao" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "meses_aplicacao" INTEGER[],
ADD COLUMN     "recorrencia" "RecorrenciaTipo",
ADD COLUMN     "ultimo_lembrete_em" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "instancia_obrigacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obrigacao_id" UUID NOT NULL,
    "contador_id" UUID NOT NULL,
    "mes_referencia" VARCHAR(7) NOT NULL,
    "vencimento" DATE NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "concluida_em" TIMESTAMPTZ,
    "lembrete_enviado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instancia_obrigacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instancia_obrigacao_contador_id_vencimento_idx" ON "instancia_obrigacao"("contador_id", "vencimento");

-- CreateIndex
CREATE INDEX "instancia_obrigacao_vencimento_lembrete_enviado_idx" ON "instancia_obrigacao"("vencimento", "lembrete_enviado");

-- CreateIndex
CREATE UNIQUE INDEX "instancia_obrigacao_obrigacao_id_mes_referencia_key" ON "instancia_obrigacao"("obrigacao_id", "mes_referencia");

-- AddForeignKey
ALTER TABLE "instancia_obrigacao" ADD CONSTRAINT "instancia_obrigacao_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "obrigacao_fiscal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instancia_obrigacao" ADD CONSTRAINT "instancia_obrigacao_contador_id_fkey" FOREIGN KEY ("contador_id") REFERENCES "usuario_contador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
