import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // Desabilitado: não queremos traces de performance no GlitchTip self-hosted
    tracesSampleRate: 0,
    beforeSend(event) {
      // Remove campos sensíveis antes de enviar (defesa em profundidade — LGPD)
      if (event.request) {
        const SENSITIVE = ['senha', 'password', 'token', 'secret', 'authorization'];

        if (event.request.data && typeof event.request.data === 'object') {
          for (const key of SENSITIVE) {
            if (key in (event.request.data as Record<string, unknown>)) {
              (event.request.data as Record<string, unknown>)[key] = '[REDACTED]';
            }
          }
        }

        if (event.request.headers) {
          for (const key of SENSITIVE) {
            if (key in (event.request.headers as Record<string, unknown>)) {
              (event.request.headers as Record<string, unknown>)[key] = '[REDACTED]';
            }
          }
        }
      }
      return event;
    },
  });
}
