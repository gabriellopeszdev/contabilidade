-- AlterTable: adiciona constraint unique no campo nome de plano_saas
ALTER TABLE "public"."plano_saas" ADD CONSTRAINT "plano_saas_nome_key" UNIQUE ("nome");
