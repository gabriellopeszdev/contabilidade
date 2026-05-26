-- AlterTable
ALTER TABLE "usuario_cliente" ADD COLUMN     "two_factor_backup_codes" TEXT[],
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_secret" VARCHAR(500);

-- AlterTable
ALTER TABLE "usuario_contador" ADD COLUMN     "two_factor_backup_codes" TEXT[],
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_secret" VARCHAR(500);
