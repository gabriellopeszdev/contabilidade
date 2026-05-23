-- AlterTable
ALTER TABLE "usuario_cliente" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "configuracao_escritorio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contador_id" UUID NOT NULL,
    "nome_escritorio" VARCHAR(255) NOT NULL,
    "cnpj_escritorio" CHAR(14),
    "logo_url" VARCHAR(1000),
    "cor_primaria" VARCHAR(9) NOT NULL DEFAULT '#2563eb',
    "cor_secundaria" VARCHAR(9) NOT NULL DEFAULT '#1e3a8a',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "configuracao_escritorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obrigacao_fiscal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contador_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" VARCHAR(500),
    "dia_vencimento" INTEGER NOT NULL,
    "cor" VARCHAR(9) NOT NULL DEFAULT '#3b82f6',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "obrigacao_fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_escritorio_contador_id_key" ON "configuracao_escritorio"("contador_id");

-- CreateIndex
CREATE INDEX "obrigacao_fiscal_contador_id_idx" ON "obrigacao_fiscal"("contador_id");

-- AddForeignKey
ALTER TABLE "configuracao_escritorio" ADD CONSTRAINT "configuracao_escritorio_contador_id_fkey" FOREIGN KEY ("contador_id") REFERENCES "usuario_contador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obrigacao_fiscal" ADD CONSTRAINT "obrigacao_fiscal_contador_id_fkey" FOREIGN KEY ("contador_id") REFERENCES "usuario_contador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
