import { DomainException } from '../exceptions/DomainException';

/**
 * Value Object: Email
 *
 * - Valida formato conforme RFC 5322 (regex simplificado amplamente adotado)
 * - Normaliza para lowercase no construtor (invariante permanente)
 * - Comparação por valor, nunca por referência
 * - Imutável após construção
 */
export class Email {
  private readonly _value: string;

  /**
   * Regex RFC 5322 simplificado. Cobre 99,9% dos e-mails válidos usados em produção.
   * Rejeita: e-mails sem TLD, com espaços, com @ duplo, domínios inválidos.
   */
  private static readonly RFC_5322_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  private static readonly MAX_LENGTH = 255;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new DomainException('E-mail não pode ser nulo ou vazio.');
    }

    const normalized = value.toLowerCase().trim();

    if (normalized.length > Email.MAX_LENGTH) {
      throw new DomainException(
        `E-mail excede o comprimento máximo de ${Email.MAX_LENGTH} caracteres.`,
      );
    }

    if (!Email.RFC_5322_REGEX.test(normalized)) {
      throw new DomainException(
        `E-mail inválido: "${value}". Formato esperado: usuario@dominio.com`,
      );
    }

    this._value = normalized;
  }

  get value(): string {
    return this._value;
  }

  /** Comparação semântica por valor (não por referência de objeto). */
  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
