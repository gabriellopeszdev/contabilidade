-- CreateTable
CREATE TABLE "chat_ia_mensagem" (
    "id" TEXT NOT NULL,
    "contador_id" UUID NOT NULL,
    "role" VARCHAR(10) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_ia_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_ia_mensagem_contador_id_created_at_idx" ON "chat_ia_mensagem"("contador_id", "created_at");

-- AddForeignKey
ALTER TABLE "chat_ia_mensagem" ADD CONSTRAINT "chat_ia_mensagem_contador_id_fkey" FOREIGN KEY ("contador_id") REFERENCES "usuario_contador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
