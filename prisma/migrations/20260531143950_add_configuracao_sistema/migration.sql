-- CreateTable
CREATE TABLE "configuracao_sistema" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "ia_provider" VARCHAR(20),
    "ia_api_key" VARCHAR(500),
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "configuracao_sistema_pkey" PRIMARY KEY ("id")
);
