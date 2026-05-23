-- AlterTable
ALTER TABLE "funcionario" ADD COLUMN     "consent_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "consent_ip_address" VARCHAR(45),
ADD COLUMN     "consent_version" VARCHAR(20);
