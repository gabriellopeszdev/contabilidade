// =============================================================================
// Validadores e formatadores reutilizáveis
// =============================================================================

// -----------------------------------------------------------------------------
// E-mail
// -----------------------------------------------------------------------------

/** Valida se o e-mail tem formato válido. */
export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// -----------------------------------------------------------------------------
// Telefone brasileiro
// Aceita:
//   (11) 91234-5678  → celular (11 dígitos com DDD)
//   (11) 1234-5678   → fixo    (10 dígitos com DDD)
//   11 912345678     → sem formatação
// Rejeita:
//   DDDs inválidos (00, 01-10, acima de 99)
//   Números com dígitos insuficientes
// -----------------------------------------------------------------------------

/** Remove tudo que não é dígito. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Valida telefone brasileiro (com ou sem formatação). */
export function validarTelefone(telefone: string): boolean {
  const digits = apenasDigitos(telefone);
  if (digits.length < 10 || digits.length > 11) return false;

  const ddd = Number(digits.substring(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  // Celular (11 dígitos): deve começar com 9
  if (digits.length === 11 && digits[2] !== '9') return false;

  return true;
}

/** Aplica máscara de telefone enquanto o usuário digita.
 *  (11) 91234-5678  ou  (11) 1234-5678
 */
export function mascararTelefone(valor: string): string {
  const digits = apenasDigitos(valor).slice(0, 11);
  const n = digits.length;

  if (n === 0) return '';
  if (n <= 2)  return `(${digits}`;
  if (n <= 6)  return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

  // Celular (9 + 8 dígitos) vs fixo (8 dígitos)
  const corpo = digits.slice(2);
  if (n <= 10) {
    // fixo: XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${corpo.slice(0, 4)}-${corpo.slice(4)}`;
  }
  // celular: XXXXX-XXXX
  return `(${digits.slice(0, 2)}) ${corpo.slice(0, 5)}-${corpo.slice(5)}`;
}
