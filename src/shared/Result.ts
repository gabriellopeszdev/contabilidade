/**
 * Padrão Result (Railway-Oriented Programming)
 *
 * Encapsula o resultado de uma operação que pode ter sucesso ou falhar
 * de forma ESPERADA pelo domínio (erros de negócio, validações, conflitos).
 *
 * QUANDO USAR:
 *   - Erros de negócio previsíveis: use Result.fail()
 *   - Erros de infraestrutura (DB down, MinIO timeout): ainda propagam como exceções
 *
 * BENEFÍCIOS:
 *   - Elimina o anti-padrão de try/catch em toda a camada de aplicação
 *   - Torna o contrato de erros explícito na assinatura da função
 *   - Permite encadeamento funcional (map, flatMap) quando necessário
 */
export type Result<T, E extends Error = Error> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: E }>;

export const Result = {
  /** Cria um resultado de sucesso com o valor fornecido. */
  ok<T>(value: T): Result<T, never> {
    return Object.freeze({ ok: true as const, value });
  },

  /** Cria um resultado de falha com o erro fornecido. */
  fail<E extends Error>(error: E): Result<never, E> {
    return Object.freeze({ ok: false as const, error });
  },

  /** Type guard — verifica se o Result é um sucesso. */
  isOk<T, E extends Error>(
    result: Result<T, E>,
  ): result is Readonly<{ ok: true; value: T }> {
    return result.ok === true;
  },

  /** Type guard — verifica se o Result é uma falha. */
  isFail<T, E extends Error>(
    result: Result<T, E>,
  ): result is Readonly<{ ok: false; error: E }> {
    return result.ok === false;
  },
};

// ---------------------------------------------------------------------------
// Type guards standalone (úteis em .filter() mantendo tipagem correta)
// ---------------------------------------------------------------------------

export function isOk<T, E extends Error>(
  result: Result<T, E>,
): result is Readonly<{ ok: true; value: T }> {
  return result.ok === true;
}

export function isFail<T, E extends Error>(
  result: Result<T, E>,
): result is Readonly<{ ok: false; error: E }> {
  return result.ok === false;
}
