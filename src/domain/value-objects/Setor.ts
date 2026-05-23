import { DomainException } from '../exceptions/DomainException';

/**
 * Tipos literais dos setores suportados pelo sistema.
 * Usado como discriminante em queries, filtros e regras de negócio.
 */
export type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL' | 'TODOS';

/** Setores "reais" que classificam documentos. TODOS é wildcard de permissão. */
export const SETORES_REAIS: readonly SetorTipo[] = ['FISCAL', 'PESSOAL', 'CONTABIL'];

type SetorConfig = {
  readonly descricao: string;
  /** Período mínimo de retenção exigido por legislação (em meses). */
  readonly retencaoMinimaEmMeses: number;
  /** Fundamento legal da retenção. */
  readonly baseRetencao: string;
};

/** Setores de documento reais (exclui TODOS, que é wildcard de permissão). */
type SetorDocumento = Exclude<SetorTipo, 'TODOS'>;

/**
 * Configuração centralizada de cada setor.
 * Retenção de 60 meses (5 anos) para todos, conforme CTN Art. 173 e legislação fiscal.
 */
const SETORES_CONFIG: Readonly<Record<SetorDocumento, SetorConfig>> = {
  FISCAL: {
    descricao: 'Documentos fiscais (NFe, NFSe, CTe, SAT, XMLs de SPED)',
    retencaoMinimaEmMeses: 60,
    baseRetencao: 'CTN Art. 173 — prescrição do crédito tributário em 5 anos',
  },
  PESSOAL: {
    descricao: 'Departamento pessoal (folhas de pagamento, contratos CLT, eSocial)',
    retencaoMinimaEmMeses: 60,
    baseRetencao: 'CLT Art. 11 e legislação trabalhista — prescrição em 5 anos',
  },
  CONTABIL: {
    descricao: 'Documentos contábeis (balanços patrimoniais, razão, SPED Contábil)',
    retencaoMinimaEmMeses: 60,
    baseRetencao: 'Lei 9.613/1998 e Código Civil Art. 1.194 — retenção mínima de 5 anos',
  },
} as const;

/**
 * Value Object: Setor (Enum Rico)
 *
 * Representa a classificação de um documento fiscal no sistema.
 * Carrega metadados de negócio junto com o tipo (retenção, base legal, descrição).
 *
 * Uso preferencial via constantes pré-instanciadas:
 *   `Setor.FISCAL`, `Setor.PESSOAL`, `Setor.CONTABIL`
 *
 * Imutável após construção. Comparação por valor via `equals()`.
 */
export class Setor {
  private readonly _tipo: SetorTipo;
  private readonly _config: SetorConfig;

  constructor(tipo: SetorTipo) {
    // TODOS é wildcard de permissão — não possui config de retenção
    if (tipo === 'TODOS') {
      this._tipo = tipo;
      this._config = {
        descricao: 'Acesso total — todos os setores',
        retencaoMinimaEmMeses: 0,
        baseRetencao: 'N/A',
      };
      return;
    }
    const config = SETORES_CONFIG[tipo];
    if (!config) {
      throw new DomainException(
        `Setor inválido: "${tipo}". Valores aceitos: ${Object.keys(SETORES_CONFIG).join(', ')}, TODOS.`,
      );
    }
    this._tipo = tipo;
    this._config = config;
  }

  // ---------------------------------------------------------------------------
  // Constantes pré-instanciadas (evita new Setor('FISCAL') espalhado pelo código)
  // ---------------------------------------------------------------------------

  static readonly FISCAL = new Setor('FISCAL');
  static readonly PESSOAL = new Setor('PESSOAL');
  static readonly CONTABIL = new Setor('CONTABIL');
  static readonly TODOS = new Setor('TODOS');

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  /**
   * Cria um Setor a partir de uma string (útil ao ler do banco de dados ou request HTTP).
   * Lança DomainException se o valor for inválido.
   */
  static fromString(value: string): Setor {
    const upper = value?.toUpperCase?.();
    if (upper === 'TODOS') return Setor.TODOS;
    if (!upper || !(upper in SETORES_CONFIG)) {
      throw new DomainException(
        `Setor inválido: "${value}". Valores aceitos: ${Object.keys(SETORES_CONFIG).join(', ')}, TODOS.`,
      );
    }
    return new Setor(upper as SetorTipo);
  }

  /** Retorna todos os tipos de setor disponíveis. */
  static todosOsTipos(): SetorTipo[] {
    return Object.keys(SETORES_CONFIG) as SetorTipo[];
  }

  // ---------------------------------------------------------------------------
  // Interface pública
  // ---------------------------------------------------------------------------

  get tipo(): SetorTipo {
    return this._tipo;
  }

  get descricao(): string {
    return this._config.descricao;
  }

  get retencaoMinimaEmMeses(): number {
    return this._config.retencaoMinimaEmMeses;
  }

  get baseRetencao(): string {
    return this._config.baseRetencao;
  }

  equals(other: Setor): boolean {
    return this._tipo === other._tipo;
  }

  toString(): string {
    return this._tipo;
  }

  toJSON(): string {
    return this._tipo;
  }
}
