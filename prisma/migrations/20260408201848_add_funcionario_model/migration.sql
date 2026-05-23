-- CreateEnum
CREATE TYPE "VinculoTipo" AS ENUM ('ESCRITORIO', 'CLIENTE');

-- CreateTable
CREATE TABLE "funcionario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" VARCHAR(500),
    "last_login_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "vinculo" "VinculoTipo" NOT NULL,
    "contador_id" UUID,
    "cliente_id" UUID,
    "setores" "SetorTipo"[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_email_key" ON "funcionario"("email");

-- CreateIndex
CREATE INDEX "funcionario_contador_id_idx" ON "funcionario"("contador_id");

-- CreateIndex
CREATE INDEX "funcionario_cliente_id_idx" ON "funcionario"("cliente_id");

-- CreateIndex
CREATE INDEX "funcionario_email_idx" ON "funcionario"("email");

-- CreateIndex
CREATE INDEX "funcionario_deleted_at_idx" ON "funcionario"("deleted_at");

-- AddForeignKey
ALTER TABLE "funcionario" ADD CONSTRAINT "funcionario_contador_id_fkey" FOREIGN KEY ("contador_id") REFERENCES "usuario_contador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funcionario" ADD CONSTRAINT "funcionario_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
