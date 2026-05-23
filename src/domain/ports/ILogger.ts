// =============================================================================
// Port: ILogger — Contrato de Logging Estruturado
//
// Mantém o domínio e a aplicação livres de qualquer dependência de biblioteca
// de logging concreta (Pino, Winston, etc.). A implementação é injetada via
// Container — princípio da Inversão de Dependência (DIP - SOLID).
//
// NÍVEIS (ordem crescente de severidade):
//   debug → info → warn → error → fatal
//
// CONVENÇÃO DE USO:
//   debug  → informações de diagnóstico (desativado em produção)
//   info   → eventos normais do sistema (startup, conexões, fluxos esperados)
//   warn   → situações anômalas mas recuperáveis (retry, fallback acionado)
//   error  → falha de uma operação (com contexto suficiente para investigar)
//   fatal  → falha irrecuperável que exige reinício do processo
// =============================================================================

/** Meta-dados de contexto passados junto com a mensagem de log. */
export type LogMeta = Record<string, unknown>;

export interface ILogger {
  debug(mensagem: string, meta?: LogMeta): void;
  info(mensagem: string,  meta?: LogMeta): void;
  warn(mensagem: string,  meta?: LogMeta): void;
  /**
   * Aceita `LogMeta` para contexto estruturado OU um `Error` para serializar
   * stack trace automaticamente (o adapter Pino usa o serializador `err`).
   */
  error(mensagem: string, meta?: LogMeta | Error): void;
  fatal(mensagem: string, meta?: LogMeta | Error): void;
}
