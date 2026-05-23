import { DomainException } from '../exceptions/DomainException';

/**
 * Value Object: CRC (Registro de Contador)
 *
 * Representa o número de registro profissional emitido pelo
 * Conselho Regional de Contabilidade (CRC) de cada estado.
 *
 * Formatos aceitos no input:
 *   - "CRC-SP/123456"
 *   - "CRCSP123456"
 *   - "SP/123456"
 *
 * Formato canônico interno: "CRC-UF/NNNNNN" (número com 6 dígitos, zero-padded)
 *
 * - Valida a UF contra a lista oficial de estados brasileiros
 * - Armazena estado e número separadamente para consultas
 * - Imutável após construção
 */
export class CRC {
  private readonly _uf: string;
  private readonly _numero: string;

  private static readonly UFS_VALIDAS = new Set([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ]);

  /**
   * Extrai UF e número de qualquer variação de formato de entrada.
   * Grupo 1: UF (2 letras). Grupo 2: número (1-9 dígitos).
   */
  private static readonly PARSE_REGEX =
    /^(?:CRC[-]?)?([A-Za-z]{2})[\/\-]?(\d{1,9})(?:[-][A-Za-z][-]\d)?$/;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new DomainException('CRC não pode ser nulo ou vazio.');
    }

    const trimmed = value.trim().toUpperCase();
    const match = trimmed.match(CRC.PARSE_REGEX);

    if (!match) {
      throw new DomainException(
        `CRC inválido: "${value}". Formato esperado: CRC-UF/NUMERO (ex: CRC-SP/123456).`,
      );
    }

    const [, uf, numero] = match;

    if (!CRC.UFS_VALIDAS.has(uf)) {
      throw new DomainException(
        `UF inválida no CRC: "${uf}". ` +
          `UFs aceitas: ${[...CRC.UFS_VALIDAS].sort().join(', ')}.`,
      );
    }

    if (numero.length > 9) {
      throw new DomainException(
        `Número do CRC inválido: "${numero}". Máximo de 9 dígitos permitidos.`,
      );
    }

    this._uf = uf;
    this._numero = numero.padStart(6, '0');
  }

  // ---------------------------------------------------------------------------
  // Interface pública
  // ---------------------------------------------------------------------------

  /** Sigla do estado emissor (ex: "SP"). */
  get uf(): string {
    return this._uf;
  }

  /** Número de registro com zero-padding (ex: "012345"). */
  get numero(): string {
    return this._numero;
  }

  /** Formato canônico para exibição e persistência (ex: "CRC-SP/012345"). */
  formatar(): string {
    return `CRC-${this._uf}/${this._numero}`;
  }

  equals(other: CRC): boolean {
    return this._uf === other._uf && this._numero === other._numero;
  }

  toString(): string {
    return this.formatar();
  }
}
