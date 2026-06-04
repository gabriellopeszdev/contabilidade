-- CreateTable
CREATE TABLE "documento_responsavel" (
    "documento_id"   UUID        NOT NULL,
    "funcionario_id" UUID        NOT NULL,
    "assigned_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "assigned_by_id" UUID        NOT NULL,

    CONSTRAINT "documento_responsavel_pkey" PRIMARY KEY ("documento_id","funcionario_id")
);

-- CreateIndex
CREATE INDEX "documento_responsavel_documento_id_idx"   ON "documento_responsavel"("documento_id");
CREATE INDEX "documento_responsavel_funcionario_id_idx" ON "documento_responsavel"("funcionario_id");

-- AddForeignKey
ALTER TABLE "documento_responsavel"
    ADD CONSTRAINT "documento_responsavel_documento_id_fkey"
    FOREIGN KEY ("documento_id") REFERENCES "documento_fiscal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_responsavel"
    ADD CONSTRAINT "documento_responsavel_funcionario_id_fkey"
    FOREIGN KEY ("funcionario_id") REFERENCES "funcionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
