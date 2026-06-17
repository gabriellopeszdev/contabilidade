import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaPg }    from '@prisma/adapter-pg';
import { Pool }        from 'pg';
import { Client as MinioClient } from 'minio';
import Redis from 'ioredis';

import { PrismaDocumentoRepository } from '../database/PrismaDocumentoRepository';
import { PrismaAuditLogRepository } from '../database/PrismaAuditLogRepository';
import { MinIOStorageAdapter } from '../storage/MinIOStorageAdapter';
import { RedisEventDispatcher } from '../events/RedisEventDispatcher';
import { ProcessarUploadLoteUseCase } from '../../application/use-cases/ProcessarUploadLoteUseCase';
import { RegistrarLeituraDocumentoUseCase } from '../../application/use-cases/RegistrarLeituraDocumentoUseCase';
import { PinoLogger } from '../logger/PinoLogger';
import { ConsoleEmailAdapter } from '../email/ConsoleEmailAdapter';
import { ResendEmailAdapter }  from '../email/ResendEmailAdapter';
import type { IEmailService }  from '../../domain/ports/IEmailService';
import { DocSealService } from '../docseal/DocSealService';
import { SignatureApiService } from '../signatureapi/SignatureApiService';

// =============================================================================
// Composition Root — Container de Injeção de Dependências
//
// Este arquivo é o único ponto do sistema onde as dependências concretas
// são instanciadas e conectadas. É o "main" da Clean Architecture.
//
// DECISÃO DE DESIGN — Singletons via módulo Node.js + padrão `global`:
//   No Next.js App Router (Node.js runtime), o módulo cache persiste entre
//   requisições no mesmo processo. Porém, em desenvolvimento, o HMR
//   (Hot-Module Reload) pode recriar módulos, esgotando o pool de conexões
//   do Prisma e do Redis. O padrão `global.___var` é a solução oficial
//   recomendada pela Prisma e pela comunidade Next.js para evitar isso.
//
//   Referência: https://www.prisma.io/docs/orm/more/help-and-troubleshooting/
//               help-articles/nextjs-prisma-client-dev-practices
//
// REDIS: Duas conexões separadas são necessárias:
//   - redisPublisher  → executa PUBLISH (usado pelo RedisEventDispatcher)
//   - redisSubscriber → executa SUBSCRIBE (criado pelo SocketServer, fora daqui)
//   Conexões Redis em modo SUBSCRIBE não podem executar outros comandos.
// =============================================================================

// ---------------------------------------------------------------------------
// Declaração global para HMR-safe singletons
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __contabilidade_logger: PinoLogger | undefined;
  // eslint-disable-next-line no-var
  var __contabilidade_prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __contabilidade_redis_pub: Redis | undefined;
  // eslint-disable-next-line no-var
  var __contabilidade_minio: MinioClient | undefined;
}

// ---------------------------------------------------------------------------
// Builders — responsáveis pela configuração de cada cliente
// ---------------------------------------------------------------------------

function buildLogger(): PinoLogger {
  return new PinoLogger();
}

function buildPrismaClient(): PrismaClient {
  // -------------------------------------------------------------------------
  // Prisma 7 — Driver Adapter obrigatório
  //
  // No Prisma 7, a URL de conexão foi removida do schema.prisma.
  // O PrismaClient recebe a conexão via driver adapter (@prisma/adapter-pg),
  // que encapsula um pool de conexões pg.Pool.
  //
  // POOL DE CONEXÕES:
  //   - max: 10 conexões (padrão pg.Pool — adequado para um escritório)
  //   - idleTimeoutMillis: 30s — fecha conexões ociosas
  //   - Em produção com alta carga: ajustar max e usar PgBouncer na frente.
  //
  // LOGGING:
  //   Usamos emit: 'event' para redirecionar os logs do Prisma ao PinoLogger
  //   em vez de escrever diretamente em stdout. Isso garante que os logs do
  //   Prisma apareçam no mesmo formato estruturado e com o requestId correto.
  // -------------------------------------------------------------------------
  const isDev = process.env.NODE_ENV === 'development';

  // Se POSTGRES_HOST estiver definido, usa opções separadas no Pool.
  // Isso evita o bug do pg onde senha vazia na URL se torna `null`
  // (pg faz `'' || null = null`) e o SASL lança "password must be a string".
  // Caso contrário, usa DATABASE_URL diretamente (já validada pelo env.ts).
  const pgPassword = process.env.POSTGRES_PASSWORD;
  const pool = process.env.POSTGRES_HOST
    ? new Pool({
        user:     process.env.POSTGRES_USER || 'postgres',
        ...(pgPassword ? { password: pgPassword } : {}),
        host:     process.env.POSTGRES_HOST,
        port:     parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB   || 'contabilidade',
        max:               10,
        idleTimeoutMillis: 30_000,
      })
    : new Pool({
        connectionString: process.env.DATABASE_URL,
        max:               10,
        idleTimeoutMillis: 30_000,
      });

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: isDev
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn'  },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });

  // Redireciona eventos do Prisma para o PinoLogger estruturado
  // `logger` já está disponível aqui — é instanciado antes do prisma no módulo.
  if (isDev) {
    client.$on('query', (e) => {
      logger.debug('[Prisma] query', {
        query:    e.query,
        params:   e.params,
        duration: `${e.duration}ms`,
      });
    });

    client.$on('warn', (e) => {
      logger.warn('[Prisma] warn', { message: e.message });
    });
  }

  client.$on('error', (e) => {
    logger.error('[Prisma] error', { message: e.message });
  });

  return client;
}

function buildRedisPublisher(): Redis {
  const client = new Redis({
    host:     process.env.REDIS_HOST     ?? 'localhost',
    port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    // Retry com backoff exponencial — reconecta automaticamente após falha
    maxRetriesPerRequest: 3,
    enableReadyCheck:     true,
    lazyConnect:          false,
    retryStrategy: (times: number) =>
      Math.min(times * 100, 3_000), // backoff: 100ms, 200ms, ... max 3s
  });

  client.on('error', (err: Error) =>
    logger.error('[Redis Publisher] Erro de conexão', { message: err.message }),
  );

  client.on('ready', () =>
    logger.info('[Redis Publisher] Conexão estabelecida.'),
  );

  return client;
}

function buildMinioClient(): MinioClient {
  return new MinioClient({
    endPoint:  process.env.MINIO_ENDPOINT    ?? 'localhost',
    port:      parseInt(process.env.MINIO_API_PORT ?? '9000', 10),
    useSSL:    process.env.MINIO_USE_SSL     === 'true',
    accessKey: process.env.MINIO_ROOT_USER   ?? '',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? '',
  });
}

function buildEmailService(): IEmailService {
  const apiKey    = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.FROM_EMAIL ?? 'noreply@contabilidade.app';
  if (apiKey) {
    return new ResendEmailAdapter(apiKey, fromEmail, logger);
  }
  return new ConsoleEmailAdapter(logger);
}

// ---------------------------------------------------------------------------
// Singletons — instanciados uma única vez por processo Node.js
//
// A ordem importa: o logger é criado primeiro para que possa ser usado
// pelos demais builders (buildRedisPublisher referencia `logger`).
// ---------------------------------------------------------------------------

export const logger =
  globalThis.__contabilidade_logger ??
  (globalThis.__contabilidade_logger = buildLogger());

const prisma =
  globalThis.__contabilidade_prisma ??
  (globalThis.__contabilidade_prisma = buildPrismaClient());

const redisPublisher =
  globalThis.__contabilidade_redis_pub ??
  (globalThis.__contabilidade_redis_pub = buildRedisPublisher());

const minioClient =
  globalThis.__contabilidade_minio ??
  (globalThis.__contabilidade_minio = buildMinioClient());

// ---------------------------------------------------------------------------
// Adapters — cada um implementa uma Port (interface) do domínio
// ---------------------------------------------------------------------------

const documentoRepository = new PrismaDocumentoRepository(prisma);
const auditLogRepository  = new PrismaAuditLogRepository(prisma);

const storageService = new MinIOStorageAdapter(
  minioClient,
  process.env.MINIO_BUCKET ?? 'documentos-contabeis',
);

const eventDispatcher = new RedisEventDispatcher(redisPublisher, logger);

// ---------------------------------------------------------------------------
// Use Cases (exportados como singletons)
//
// Os use cases são stateless: todo o estado é passado via parâmetros em cada
// chamada. Compartilhá-los entre requisições é seguro e evita re-instanciar
// o grafo de dependências a cada request.
// ---------------------------------------------------------------------------

export const processarUploadLoteUseCase = new ProcessarUploadLoteUseCase(
  documentoRepository,
  storageService,
  auditLogRepository,
  eventDispatcher,
);

export const registrarLeituraDocumentoUseCase = new RegistrarLeituraDocumentoUseCase(
  documentoRepository,
  auditLogRepository,
  eventDispatcher,
);

export const emailService: IEmailService = buildEmailService();

export const docSealService = new DocSealService(
  process.env.DOCSEAL_API_URL ?? 'http://docseal:3000',
  process.env.DOCSEAL_API_KEY ?? '',
);

export const signatureApiService = new SignatureApiService(
  process.env.SIGNATUREAPI_API_KEY ?? '',
);

// ---------------------------------------------------------------------------
// Exportações de infraestrutura bruta
//
// Exportados para uso direto em casos específicos:
//   - `prisma`        → migrações, scripts de seed, testes de integração
//   - `redisPublisher`→ injetado no SocketServer para criar o subscriber
//                       com a mesma configuração de conexão
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __contabilidade_bullmq_queue: Queue | undefined;
}

function buildQueueProducer(): Queue {
  return new Queue('processamento_arquivos_pesados', {
    connection: {
      host:     process.env.REDIS_HOST     ?? 'localhost',
      port:     parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD ?? undefined,
    },
  });
}

export const queueProducer =
  globalThis.__contabilidade_bullmq_queue ??
  (globalThis.__contabilidade_bullmq_queue = buildQueueProducer());

export { prisma, redisPublisher, minioClient, storageService, documentoRepository, eventDispatcher };
