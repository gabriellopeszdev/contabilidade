import pino from 'pino';
import pretty from 'pino-pretty';

import type { ILogger, LogMeta } from '../../domain/ports/ILogger';

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
// =============================================================================

/** Caminhos redactados em qualquer profundidade de objeto. */
const REDACT_PATHS: string[] = [
  // Raiz
  'senha', 'password', 'token', 'secret', 'authorization',
  // Um nível de aninhamento (ex: req.body.password, payload.token)
  '*.senha', '*.password', '*.token', '*.secret', '*.authorization',
];

export class PinoLogger implements ILogger {
  private readonly logger: ReturnType<typeof pino>;

  constructor() {
    const isDev = process.env.NODE_ENV !== 'production';

    const level = isDev ? 'debug' : 'info';

    // Stream síncrono do pino-pretty — bypassa Worker Threads que o Webpack
    // do Next.js não consegue resolver (erro "unable to determine transport target").
    const stream = isDev
      ? pretty({ colorize: true, translateTime: 'SYS:standard' })
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
  // ---------------------------------------------------------------------------

  debug(mensagem: string, meta?: LogMeta): void {
    meta ? this.logger.debug(meta, mensagem) : this.logger.debug(mensagem);
  }

  info(mensagem: string, meta?: LogMeta): void {
    meta ? this.logger.info(meta, mensagem) : this.logger.info(mensagem);
  }

  warn(mensagem: string, meta?: LogMeta): void {
    meta ? this.logger.warn(meta, mensagem) : this.logger.warn(mensagem);
  }

  error(mensagem: string, meta?: LogMeta | Error): void {
    if (meta instanceof Error) {
      // Pino serializa `err` com type, message, stack (serializador nativo)
      this.logger.error({ err: meta }, mensagem);
    } else {
      meta ? this.logger.error(meta, mensagem) : this.logger.error(mensagem);
    }
  }

  fatal(mensagem: string, meta?: LogMeta | Error): void {
    if (meta instanceof Error) {
      this.logger.fatal({ err: meta }, mensagem);
    } else {
      meta ? this.logger.fatal(meta, mensagem) : this.logger.fatal(mensagem);
    }
  }
}
