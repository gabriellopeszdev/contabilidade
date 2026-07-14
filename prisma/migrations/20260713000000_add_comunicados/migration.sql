-- CreateTable
CREATE TABLE "comunicados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "contador_id" UUID NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "conteudo" TEXT NOT NULL,
    "anexo_path" TEXT,
    "anexo_nome" TEXT,
    "exige_confirmacao" BOOLEAN NOT NULL DEFAULT false,
    "targeting" VARCHAR(20) NOT NULL,
    "setor" VARCHAR(20),
    "publicado_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "comunicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicado_destinatarios" (
    "comunicado_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "lido_at" TIMESTAMPTZ,
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    "confirmado_at" TIMESTAMPTZ,

    CONSTRAINT "comunicado_destinatarios_pkey" PRIMARY KEY ("comunicado_id","cliente_id")
);

-- CreateIndex
CREATE INDEX "comunicados_contador_id_idx" ON "comunicados"("contador_id");

-- CreateIndex
CREATE INDEX "comunicados_publicado_at_idx" ON "comunicados"("publicado_at" DESC);

-- CreateIndex
CREATE INDEX "comunicado_destinatarios_cliente_id_idx" ON "comunicado_destinatarios"("cliente_id");

-- AddForeignKey
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_contador_id_fkey" FOREIGN KEY ("contador_id") REFERENCES "usuario_contador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado_destinatarios" ADD CONSTRAINT "comunicado_destinatarios_comunicado_id_fkey" FOREIGN KEY ("comunicado_id") REFERENCES "comunicados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado_destinatarios" ADD CONSTRAINT "comunicado_destinatarios_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
