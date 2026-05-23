import { DomainException } from '../exceptions/DomainException';

/**
 * Value Object: CNPJ
 *
 * - Valida os dois dígitos verificadores no construtor (algoritmo oficial Receita Federal)
 * - Armazena internamente apenas os 14 dígitos (sem formatação)
 * - Expõe método `formatar()` para exibição com máscara XX.XXX.XXX/XXXX-XX
 * - Rejeita CNPJs com todos os dígitos iguais (ex: 00000000000000)
 * - Imutável após construção
 */
export class CNPJ {
  private readonly _digitos: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new DomainException('CNPJ não pode ser nulo ou vazio.');
    }

    const digitos = CNPJ.extrairDigitos(value);

    if (!CNPJ.isValid(digitos)) {
      throw new DomainException(
        `CNPJ inválido: "${value}". Forneça um CNPJ com 14 dígitos e dígitos verificadores corretos.`,
      );
    }

    this._digitos = digitos;
  }

  // ---------------------------------------------------------------------------
  // Validação (algoritmo oficial da Receita Federal)
  // ---------------------------------------------------------------------------

  private static extrairDigitos(value: string): string {
    return value.replace(/\D/g, '');
  }

  private static calcularDigitoVerificador(parcial: string, pesos: number[]): number {
    const soma = parcial.split('').reduce((acc, digito, i) => {
      return acc + parseInt(digito, 10) * pesos[i];
    }, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  private static isValid(digitos: string): boolean {
    if (digitos.length !== 14) return false;

    // Rejeita sequências homogêneas (00000000000000, 11111111111111, etc.)
    if (/^(\d)\1{13}$/.test(digitos)) return false;

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const primeiroDigito = CNPJ.calcularDigitoVerificador(digitos.slice(0, 12), pesos1);
    if (parseInt(digitos[12], 10) !== primeiroDigito) return false;

    const segundoDigito = CNPJ.calcularDigitoVerificador(digitos.slice(0, 13), pesos2);
    if (parseInt(digitos[13], 10) !== segundoDigito) return false;

    return true;
  }

  // ---------------------------------------------------------------------------
  // Interface pública
  // ---------------------------------------------------------------------------

  /** Retorna os 14 dígitos sem formatação. Use para persistência. */
  get value(): string {
    return this._digitos;
  }

  /** Retorna o CNPJ com máscara XX.XXX.XXX/XXXX-XX. Use para exibição. */
  formatar(): string {
    return this._digitos.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  equals(other: CNPJ): boolean {
    return this._digitos === other._digitos;
  }

  toString(): string {
    return this.formatar();
  }
}
