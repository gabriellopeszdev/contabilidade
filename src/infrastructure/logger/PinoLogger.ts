import pino from 'pino';
import pretty from 'pino-pretty';

import type { ILogger, LogMeta } from '../../domain/ports/ILogger';
import { RequestContext } from './RequestContext';

// =============================================================================
// PinoLogger — Adapter concreto de logging usando Pino
//
// AMBIENTE:
//   development → pino-pretty injetado como stream síncrono (bypassa Worker
//                 Threads — evita o erro "unable to determine transport target"
//                 causado pelo Webpack do Next.js reescrevendo caminhos)
//   production  → JSON puro em stdout (alta performance, pronto para ingestão
//                 por ferramentas como Loki, Datadog, ELK, CloudWatch)
//
// REDACTION (Segurança / LGPD):
//   Qualquer chave listada em REDACT_PATHS é substituída por '[REDACTED]'
//   antes de o log ser escrito — independente de quem chamou o logger.
//   Protege contra vazamento acidental de credenciais em logs de erro.
//
// SERIALIZAÇÃO DE ERROS:
//   Quando `meta` é um `Error`, passamos como `{ err: meta }` para que o
//   serializador nativo do Pino inclua `type`, `message` e `stack` no JSON.
//
// REQUEST CONTEXT (AsyncLocalStorage):
//   Todos os métodos de log mesclam automaticamente requestId, userId e role
//   do AsyncLocalStorage — sem exigir passagem manual por toda a cadeia.
// =============================================================================

/** Caminhos redactados em qualquer profundidade de objeto. */
const REDACT_PATHS: string[] = [
  // Raiz
  'senha', 'password', 'token', 'secret', 'authorization',
  'arquivoCifrado', 'senhaCifrada',
  // Um nível de aninhamento (ex: req.body.password, payload.token)
  '*.senha', '*.password', '*.token', '*.secret', '*.authorization',
  '*.arquivoCifrado', '*.senhaCifrada',
];

/** Extrai os campos relevantes do RequestContext para mesclar nos logs. */
function getContextFields(): Record<string, string> {
  const ctx = RequestContext.get();
  if (!ctx) return {};

  const fields: Record<string, string> = { requestId: ctx.requestId };
  if (ctx.userId) fields.userId = ctx.userId;
  if (ctx.role)   fields.role   = ctx.role;
  return fields;
}

/** Mescla o contexto de requisição em um objeto de meta-dados. */
function mergeContext(meta?: LogMeta): LogMeta {
  return { ...getContextFields(), ...meta };
}

export class PinoLogger implements ILogger {
  private readonly logger: ReturnType<typeof pino>;

  constructor() {
    const isDev = process.env.NODE_ENV !== 'production';

    const level = isDev ? 'debug' : 'info';

    // Stream síncrono do pino-pretty — bypassa Worker Threads que o Webpack
    // do Next.js não consegue resolver (erro "unable to determine transport target").
    const stream = isDev
      ? pretty({
          colorize:      true,
          translateTime: 'HH:MM:ss',
          ignore:        'pid,hostname',
          singleLine:    false,
          messageFormat: (log, messageKey) => {
            const reqId = (log as Record<string, unknown>).requestId;
            const msg   = String((log as Record<string, unknown>)[messageKey] ?? '');
            return reqId ? `[${reqId}] ${msg}` : msg;
          },
        })
      : undefined;

    this.logger = pino(
      {
        level,

        redact: {
          paths:  REDACT_PATHS,
          censor: '[REDACTED]',
        },

        // Produção: ISO timestamp para correlação com outros serviços
        ...(!isDev && { timestamp: pino.stdTimeFunctions.isoTime }),
      },
      stream as any,
    );
  }

  // ---------------------------------------------------------------------------
  // Métodos públicos — delegam ao logger Pino com a assinatura (obj, msg)
  // que coloca os metadados como campos de primeiro nível no JSON.
  // Todos os métodos mesclam automaticamente o contexto de requisição (requestId,
  // userId, role) via AsyncLocalStorage.
  // ---------------------------------------------------------------------------

  debug(mensagem: string, meta?: LogMeta): void {
    this.logger.debug(mergeContext(meta), mensagem);
  }

  info(mensagem: string, meta?: LogMeta): void {
    this.logger.info(mergeContext(meta), mensagem);
  }

  warn(mensagem: string, meta?: LogMeta): void {
    this.logger.warn(mergeContext(meta), mensagem);
  }

  error(mensagem: string, meta?: LogMeta | Error): void {
    if (meta instanceof Error) {
      // Pino serializa `err` com type, message, stack (serializador nativo)
      this.logger.error({ ...getContextFields(), err: meta }, mensagem);
      // Lazy import para não quebrar build/edge runtime quando SENTRY_DSN não está configurado
      void import('@sentry/nextjs').then(({ captureException }) => {
        captureException(meta, { extra: getContextFields() });
      }).catch(() => {});
    } else {
      this.logger.error(mergeContext(meta), mensagem);
    }
  }

  fatal(mensagem: string, meta?: LogMeta | Error): void {
    if (meta instanceof Error) {
      this.logger.fatal({ ...getContextFields(), err: meta }, mensagem);
      // Lazy import para não quebrar build/edge runtime quando SENTRY_DSN não está configurado
      void import('@sentry/nextjs').then(({ captureException }) => {
        captureException(meta, { extra: getContextFields() });
      }).catch(() => {});
    } else {
      this.logger.fatal(mergeContext(meta), mensagem);
    }
  }
}
