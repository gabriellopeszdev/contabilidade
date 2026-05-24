-- CreateTable
CREATE TABLE "notificacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "user_type" VARCHAR(20) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "mensagem" VARCHAR(500) NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "metadados" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacao_user_id_lida_idx" ON "notificacao"("user_id", "lida");

-- CreateIndex
CREATE INDEX "notificacao_user_id_created_at_idx" ON "notificacao"("user_id", "created_at" DESC);
