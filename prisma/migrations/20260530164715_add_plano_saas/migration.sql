-- CreateEnum
CREATE TYPE "StatusAssinaturaSaaS" AS ENUM ('TRIAL', 'ATIVO', 'INADIMPLENTE', 'CANCELADO', 'SUSPENSO');

-- CreateTable
CREATE TABLE "plano_saas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(100) NOT NULL,
    "descricao" VARCHAR(500),
    "preco" DECIMAL(10,2) NOT NULL,
    "limite_clientes" INTEGER NOT NULL,
    "limite_documentos" INTEGER NOT NULL,
    "features" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plano_saas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinatura_saas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "escritorio_id" UUID NOT NULL,
    "plano_id" UUID NOT NULL,
    "status" "StatusAssinaturaSaaS" NOT NULL DEFAULT 'TRIAL',
    "data_inicio" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_renovacao" TIMESTAMPTZ NOT NULL,
    "dia_vencimento" INTEGER NOT NULL DEFAULT 10,
    "valor_mensal" DECIMAL(10,2) NOT NULL,
    "observacoes" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assinatura_saas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assinatura_saas_escritorio_id_key" ON "assinatura_saas"("escritorio_id");

-- CreateIndex
CREATE INDEX "assinatura_saas_plano_id_idx" ON "assinatura_saas"("plano_id");

-- CreateIndex
CREATE INDEX "assinatura_saas_status_idx" ON "assinatura_saas"("status");

-- AddForeignKey
ALTER TABLE "assinatura_saas" ADD CONSTRAINT "assinatura_saas_escritorio_id_fkey" FOREIGN KEY ("escritorio_id") REFERENCES "usuario_contador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura_saas" ADD CONSTRAINT "assinatura_saas_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "plano_saas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
