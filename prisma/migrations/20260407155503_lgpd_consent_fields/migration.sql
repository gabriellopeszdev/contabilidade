-- CreateEnum
CREATE TYPE "SetorTipo" AS ENUM ('FISCAL', 'PESSOAL', 'CONTABIL');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('XML', 'PDF');

-- CreateEnum
CREATE TYPE "EstadoTarefa" AS ENUM ('PENDING', 'PROCESSING', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "PrioridadeTarefa" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('DOWNLOAD', 'VIEW', 'UPLOAD_BATCH', 'LOGIN', 'LOGOUT', 'STATE_CHANGE', 'OFFBOARD_INITIATED', 'OFFBOARD_COMPLETED', 'LGPD_EXPORT', 'LGPD_ANONYMIZE', 'CONSENT_ACCEPTED', 'ACCOUNT_DELETED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('DOCUMENT', 'TASK', 'USER', 'SESSION', 'OFFBOARDING');

-- CreateTable
CREATE TABLE "usuario_cliente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" VARCHAR(500),
    "last_login_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "consent_version" VARCHAR(20),
    "consent_accepted_at" TIMESTAMPTZ,
    "consent_ip_address" INET,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "usuario_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_contador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "crc" VARCHAR(30) NOT NULL,
    "phone" VARCHAR(20),
    "avatar_url" VARCHAR(500),
    "last_login_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "consent_version" VARCHAR(20),
    "consent_accepted_at" TIMESTAMPTZ,
    "consent_ip_address" INET,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "usuario_contador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contador_cliente" (
    "contador_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contador_cliente_pkey" PRIMARY KEY ("contador_id","cliente_id")
);

-- CreateTable
CREATE TABLE "documento_fiscal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "sector" "SetorTipo" NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "storage_path" VARCHAR(1000) NOT NULL,
    "file_type" "FileType" NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "file_hash" CHAR(64) NOT NULL,
    "read_status" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "competencia" DATE,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "documento_fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefa_kanban" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "assigned_to" UUID,
    "document_id" UUID,
    "sector" "SetorTipo",
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "current_state" "EstadoTarefa" NOT NULL DEFAULT 'PENDING',
    "priority" "PrioridadeTarefa" NOT NULL DEFAULT 'MEDIUM',
    "due_date" DATE,
    "completed_at" TIMESTAMPTZ,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tarefa_kanban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID,
    "user_id" UUID NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "details_json" JSONB NOT NULL DEFAULT '{}',
    "ip_address" INET NOT NULL,
    "user_agent" VARCHAR(500),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_cliente_email_key" ON "usuario_cliente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_cliente_cnpj_key" ON "usuario_cliente"("cnpj");

-- CreateIndex
CREATE INDEX "usuario_cliente_email_idx" ON "usuario_cliente"("email");

-- CreateIndex
CREATE INDEX "usuario_cliente_deleted_at_idx" ON "usuario_cliente"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_contador_email_key" ON "usuario_contador"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_contador_crc_key" ON "usuario_contador"("crc");

-- CreateIndex
CREATE INDEX "usuario_contador_email_idx" ON "usuario_contador"("email");

-- CreateIndex
CREATE INDEX "usuario_contador_deleted_at_idx" ON "usuario_contador"("deleted_at");

-- CreateIndex
CREATE INDEX "contador_cliente_cliente_id_idx" ON "contador_cliente"("cliente_id");

-- CreateIndex
CREATE INDEX "documento_fiscal_client_id_sector_idx" ON "documento_fiscal"("client_id", "sector");

-- CreateIndex
CREATE INDEX "documento_fiscal_client_id_file_type_idx" ON "documento_fiscal"("client_id", "file_type");

-- CreateIndex
CREATE INDEX "documento_fiscal_client_id_read_status_idx" ON "documento_fiscal"("client_id", "read_status");

-- CreateIndex
CREATE INDEX "documento_fiscal_client_id_competencia_idx" ON "documento_fiscal"("client_id", "competencia");

-- CreateIndex
CREATE INDEX "documento_fiscal_file_hash_client_id_idx" ON "documento_fiscal"("file_hash", "client_id");

-- CreateIndex
CREATE INDEX "documento_fiscal_deleted_at_idx" ON "documento_fiscal"("deleted_at");

-- CreateIndex
CREATE INDEX "tarefa_kanban_client_id_current_state_idx" ON "tarefa_kanban"("client_id", "current_state");

-- CreateIndex
CREATE INDEX "tarefa_kanban_client_id_priority_idx" ON "tarefa_kanban"("client_id", "priority");

-- CreateIndex
CREATE INDEX "tarefa_kanban_assigned_to_idx" ON "tarefa_kanban"("assigned_to");

-- CreateIndex
CREATE INDEX "tarefa_kanban_document_id_idx" ON "tarefa_kanban"("document_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_timestamp_idx" ON "audit_log"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_log_document_id_timestamp_idx" ON "audit_log"("document_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_log_action_type_timestamp_idx" ON "audit_log"("action_type", "timestamp");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- AddForeignKey
ALTER TABLE "contador_cliente" ADD CONSTRAINT "contador_cliente_contador_id_fkey" FOREIGN KEY ("contador_id") REFERENCES "usuario_contador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contador_cliente" ADD CONSTRAINT "contador_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_fiscal" ADD CONSTRAINT "documento_fiscal_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "usuario_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefa_kanban" ADD CONSTRAINT "tarefa_kanban_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "usuario_contador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefa_kanban" ADD CONSTRAINT "tarefa_kanban_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documento_fiscal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
