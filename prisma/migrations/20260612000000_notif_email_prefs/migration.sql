-- AlterTable: UsuarioCliente — adicionar colunas de preferência de notificação
ALTER TABLE "usuario_cliente"
  ADD COLUMN "notif_email_novo_doc" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notif_email_boleto"   BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: UsuarioContador — adicionar coluna de preferência de notificação
ALTER TABLE "usuario_contador"
  ADD COLUMN "notif_email_novo_doc" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: BoletoHonorario — adicionar coluna de lembrete enviado
ALTER TABLE "boleto_honorario"
  ADD COLUMN "lembrete_enviado" BOOLEAN NOT NULL DEFAULT false;
