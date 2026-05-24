/*
  Warnings:

  - A unique constraint covering the columns `[reset_token]` on the table `usuario_contador` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "usuario_contador" ADD COLUMN     "reset_token" VARCHAR(255),
ADD COLUMN     "reset_token_expires_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "usuario_contador_reset_token_key" ON "usuario_contador"("reset_token");
