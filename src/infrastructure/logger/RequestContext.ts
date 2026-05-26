import { AsyncLocalStorage } from 'async_hooks';

// =============================================================================
// RequestContext — Armazena contexto de uma requisição HTTP via AsyncLocalStorage
//
// Permite que qualquer log emitido durante o processamento de uma requisição
// inclua automaticamente requestId, userId e role — sem precisar passar
// esses valores manualmente por toda a cadeia de chamadas.
//
// USO:
//   RequestContext.run(ctx, () => handler(req, res));
//   // qualquer logger.info() dentro do handler já inclui requestId, userId, role
// =============================================================================

interface IRequestContext {
  requestId: string;
  userId?:   string;
  role?:     string;
  ip?:       string;
}

const storage = new AsyncLocalStorage<IRequestContext>();

export const RequestContext = {
  /** Executa `fn` dentro de um contexto de requisição. */
  run: <T>(ctx: IRequestContext, fn: () => T): T => storage.run(ctx, fn),

  /** Retorna o contexto da requisição atual, ou `undefined` fora de um contexto. */
  get: (): IRequestContext | undefined => storage.getStore(),

  /** Retorna o requestId atual, ou `'-'` se não houver contexto. */
  getRequestId: (): string => storage.getStore()?.requestId ?? '-',
};
