import type { IncomingMessage, ServerResponse } from 'node:http';

import { RequestContext } from '../../logger/RequestContext';

// =============================================================================
// withRequestLogging — Middleware de Logging HTTP para o servidor customizado
//
// Envolve o handler do Next.js (http.IncomingMessage → ServerResponse) para:
//   1. Gerar um requestId único via crypto.randomUUID()
//   2. Extrair IP real (x-forwarded-for → x-real-ip → socket.remoteAddress)
//   3. Decodificar userId/role do JWT no cookie `token` (sem verificação de
//      assinatura — o withAuth faz isso; aqui só queremos correlação de logs)
//   4. Injetar tudo no AsyncLocalStorage via RequestContext.run()
//   5. Logar "→ METHOD /path" antes e "← STATUS in Xms" depois de cada request
//
// NOTAS DE SEGURANÇA:
//   - O decode do JWT aqui é apenas base64url — não verifica assinatura.
//   - Nunca use o userId extraído aqui para decisões de autorização.
//   - A autorização real ocorre dentro do withAuth em cada route handler.
// =============================================================================

type NextHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  parsedUrl?: import('node:url').UrlWithParsedQuery,
) => Promise<void> | void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extrai o IP real da requisição, preferindo headers de proxy. */
function extractIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * Tenta decodificar o payload de um JWT sem verificar a assinatura.
 * Retorna `null` se o token estiver malformado.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    // JWT usa base64url — substituímos para base64 padrão antes de decodificar
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json   = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extrai o token JWT do header Authorization ou do cookie `token`.
 * Prioriza Authorization, para cobrir tanto API calls quanto browser sessions.
 */
function extractJwtFromRequest(req: IncomingMessage): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() || null;
  }

  // 2. Cookie token=<token>
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const match = /(?:^|;\s*)token=([^;]+)/.exec(cookieHeader);
    if (match?.[1]) return match[1];
  }

  return null;
}

// ---------------------------------------------------------------------------
// Middleware principal
// ---------------------------------------------------------------------------

/**
 * Envolve o handler HTTP do Next.js com logging estruturado e RequestContext.
 *
 * @param handler  O `app.getRequestHandler()` do Next.js
 * @param logger   Instância de ILogger (já com pino configurado)
 * @returns        Handler compatível com `http.createServer()`
 */
export function withRequestLogging(
  handler: NextHandler,
  logger:  import('../../../domain/ports/ILogger').ILogger,
): NextHandler {
  return (req, res, parsedUrl) => {
    const requestId = crypto.randomUUID();
    const ip        = extractIp(req);
    const method    = req.method ?? 'GET';
    const url       = req.url ?? '/';
    const start     = Date.now();

    // Decodifica JWT (sem verify) apenas para correlação de logs
    let userId: string | undefined;
    let role:   string | undefined;

    const token = extractJwtFromRequest(req);
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload) {
        if (typeof payload.sub  === 'string') userId = payload.sub;
        if (typeof payload.role === 'string') role   = payload.role;
      }
    }

    const ctx = { requestId, ip, userId, role };

    return RequestContext.run(ctx, () => {
      // Log de entrada — usa logger diretamente (o contexto já está no storage)
      logger.info(`→ ${method} ${url}`, { requestId, ip });

      // Intercepta o fim da resposta para logar status + duração
      const originalEnd = res.end.bind(res);

      // @ts-expect-error — sobrescrevemos end para capturar o momento exato do envio
      res.end = (...args: Parameters<typeof res.end>) => {
        const ms     = Date.now() - start;
        const status = res.statusCode;
        const msg    = `← ${status} in ${ms}ms`;
        const meta   = { requestId, userId, durationMs: ms };

        if (status >= 500) {
          logger.error(msg, meta);
        } else if (status >= 400) {
          logger.warn(msg, meta);
        } else {
          logger.info(msg, meta);
        }

        return originalEnd(...args);
      };

      return handler(req, res, parsedUrl);
    });
  };
}
