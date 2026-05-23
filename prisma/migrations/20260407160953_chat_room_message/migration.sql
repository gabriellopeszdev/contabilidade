-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CONTADOR', 'CLIENTE');

-- CreateTable
CREATE TABLE "chat_room" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_type" "SenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "document_id" UUID,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_room_cliente_id_key" ON "chat_room"("cliente_id");

-- CreateIndex
CREATE INDEX "chat_room_cliente_id_idx" ON "chat_room"("cliente_id");

-- CreateIndex
CREATE INDEX "chat_message_room_id_created_at_idx" ON "chat_message"("room_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_message_room_id_read_at_idx" ON "chat_message"("room_id", "read_at");

-- CreateIndex
CREATE INDEX "chat_message_sender_id_idx" ON "chat_message"("sender_id");

-- AddForeignKey
ALTER TABLE "chat_room" ADD CONSTRAINT "chat_room_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documento_fiscal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
