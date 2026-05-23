-- AlterTable: make password_hash nullable for invite-based onboarding
ALTER TABLE "usuario_cliente" ALTER COLUMN "password_hash" DROP NOT NULL;

-- AddColumn: invite_token (unique, for account activation links)
ALTER TABLE "usuario_cliente" ADD COLUMN "invite_token" VARCHAR(255);

-- AddColumn: invite_expires_at
ALTER TABLE "usuario_cliente" ADD COLUMN "invite_expires_at" TIMESTAMPTZ;

-- AddColumn: activated_at
ALTER TABLE "usuario_cliente" ADD COLUMN "activated_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "usuario_cliente_invite_token_key" ON "usuario_cliente"("invite_token");
