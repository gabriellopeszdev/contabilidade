import { z } from 'zod';

// =============================================================================
// Validação de Ambiente — Fail-Fast com Zod
//
// Este módulo valida TODAS as variáveis de ambiente necessárias ao servidor.
// Se qualquer variável obrigatória estiver ausente ou inválida, o processo
// lança um erro descritivo e aborta ANTES de qualquer conexão ser aberta.
//
// USO:
//   import { env } from '@/src/config/env';
//   env.DATABASE_URL  // string validada
//   env.REDIS_PORT    // number já convertido
//
// IMPORTANTE: Este módulo só deve ser importado em contexto Node.js (servidor).
// Não importar em componentes React ou arquivos marcados com 'use client'.
// =============================================================================

const envSchema = z.object({
  // ---------------------------------------------------------------------------
  // Runtime
  // ---------------------------------------------------------------------------
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  HOST: z.string().default('0.0.0.0'),

  PORT: z.coerce.number().int().positive().default(3000),

  // ---------------------------------------------------------------------------
  // Banco de Dados (PostgreSQL)
  // ---------------------------------------------------------------------------

  /** URL completa de conexão. Ex: postgresql://user:pass@host:5432/dbname */
  DATABASE_URL: z
    .string()
    .optional()
    .transform((val) => {
      if (val) return val;
      const user = process.env.POSTGRES_USER || 'postgres';
      const password = process.env.POSTGRES_PASSWORD || '';
      const host = process.env.POSTGRES_HOST || 'localhost';
      const port = process.env.POSTGRES_PORT || '5432';
      const db = process.env.POSTGRES_DB || 'contabilidade';
      return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
    })
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      'DATABASE_URL deve começar com postgresql:// ou postgres://.',
    ),

  // ---------------------------------------------------------------------------
  // Redis
  // ---------------------------------------------------------------------------

  REDIS_HOST: z.string().default('localhost'),

  REDIS_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(6379),

  /** Senha do Redis. Undefined se não configurado (Redis sem auth). */
  REDIS_PASSWORD: z.string().optional(),

  // ---------------------------------------------------------------------------
  // MinIO (Object Storage)
  // ---------------------------------------------------------------------------

  MINIO_ENDPOINT: z.string().default('localhost'),

  MINIO_API_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(9000),

  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  MINIO_ROOT_USER: z
    .string({ required_error: 'MINIO_ROOT_USER é obrigatória.' })
    .min(3, 'MINIO_ROOT_USER deve ter ao menos 3 caracteres.'),

  MINIO_ROOT_PASSWORD: z
    .string({ required_error: 'MINIO_ROOT_PASSWORD é obrigatória.' })
    .min(8, 'MINIO_ROOT_PASSWORD deve ter ao menos 8 caracteres.'),

  MINIO_BUCKET: z.string().default('documentos-contabeis'),

  /**
   * Hostname público do MinIO — usado para gerar presigned URLs que o browser consegue acessar.
   * Quando definido, o Nginx deve fazer proxy de /{MINIO_BUCKET}/ → http://minio:9000/.
   * Deixe vazio em desenvolvimento local (usa minio:9000 diretamente).
   */
  MINIO_PUBLIC_ENDPOINT: z.string().optional(),
  MINIO_PUBLIC_PORT: z.coerce.number().int().min(1).max(65535).default(443),
  MINIO_PUBLIC_SSL:  z.string().transform((v) => v !== 'false').default('true'),

  // ---------------------------------------------------------------------------
  // Autenticação (JWT)
  // ---------------------------------------------------------------------------

  /** Segredo para assinar/verificar JWTs (HS256). Mínimo 32 caracteres. */
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET é obrigatória.' })
    .min(32, 'JWT_SECRET deve ter ao menos 32 caracteres por segurança.'),

  // ---------------------------------------------------------------------------
  // URLs Públicas
  // ---------------------------------------------------------------------------

  /** URL base pública da aplicação. Usada no CORS do WebSocket. */
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL deve ser uma URL válida.')
    .default('http://localhost:3000'),
});

// ---------------------------------------------------------------------------
// Execução da validação (fail-fast no carregamento do módulo)
// ---------------------------------------------------------------------------

function validarEnv() {
  const resultado = envSchema.safeParse(process.env);

  if (!resultado.success) {
    const erros = resultado.error.errors
      .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    throw new Error(
      `\n[env] Variáveis de ambiente inválidas ou ausentes:\n${erros}\n\n` +
        'Verifique o arquivo .env e reinicie o servidor.',
    );
  }

  return resultado.data;
}

export const env = validarEnv();

// Garante que process.env.DATABASE_URL esteja definido para Prisma (migrations/CLI).
// Só seta se o usuário não definiu explicitamente — quando POSTGRES_HOST está definido,
// o Container.ts usa opções separadas e não depende desta variável.
if (!process.env.DATABASE_URL && !process.env.POSTGRES_HOST) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

/** Tipo inferido do schema — útil para typing em outras camadas. */
export type Env = z.infer<typeof envSchema>;
