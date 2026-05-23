import { DomainException } from '../exceptions/DomainException';

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

export type ActionType =
  | 'DOWNLOAD'
  | 'VIEW'
  | 'UPLOAD_BATCH'
  | 'LOGIN'
  | 'LOGOUT'
  | 'STATE_CHANGE'
  | 'OFFBOARD_INITIATED'
  | 'OFFBOARD_COMPLETED'
  | 'LGPD_EXPORT'
  | 'LGPD_ANONYMIZE';

export type ResourceType = 'DOCUMENT' | 'TASK' | 'USER' | 'SESSION' | 'OFFBOARDING';

export interface AuditLogProps {
  readonly id: string;
  readonly documentId: string | null;
  readonly userId: string;
  readonly actionType: ActionType;
  readonly resourceType: ResourceType;
  readonly detailsJson: Readonly<Record<string, unknown>>;
  readonly ipAddress: string;
  readonly userAgent: string | null;
  readonly timestamp: Date;
}

// ---------------------------------------------------------------------------
// Entidade Imutável: AuditLog
// ---------------------------------------------------------------------------

/**
 * Entidade Imutável: AuditLog
 *
 * Registro imutável de toda ação relevante executada no sistema.
 * Implementa o padrão Append-Only — uma vez criado, NUNCA é modificado.
 *
 * DESIGN:
 *   - Construtor privado: instanciação exclusiva via factory estático `criar()`.
 *   - Sem setters: todos os campos são `readonly`.
 *   - Sem herança de AggregateRoot: AuditLog não emite eventos (é um evento em si).
 *   - Persistido em tabela particionada por mês para performance.
 *
 * IMPORTANTE:
 *   - Nunca inclua dados sensíveis (senhas, tokens, CPF/CNPJ) em `detailsJson`.
 *   - O campo `ipAddress` armazena IPv4 ou IPv6 (tipo INET no PostgreSQL).
 */
export class AuditLog {
  private readonly _props: AuditLogProps;

  /** Construtor privado — use `AuditLog.criar()`. */
  private constructor(props: AuditLogProps) {
    AuditLog.validarProps(props);
    this._props = Object.freeze({ ...props, detailsJson: Object.freeze({ ...props.detailsJson }) });
  }

  // ---------------------------------------------------------------------------
  // Validação de invariantes
  // ---------------------------------------------------------------------------

  private static validarProps(props: AuditLogProps): void {
    if (!props.id?.trim()) {
      throw new DomainException('AuditLog: ID é obrigatório.');
    }
    if (!props.userId?.trim()) {
      throw new DomainException('AuditLog: userId é obrigatório.');
    }
    if (!props.actionType?.trim()) {
      throw new DomainException('AuditLog: actionType é obrigatório.');
    }
    if (!props.resourceType?.trim()) {
      throw new DomainException('AuditLog: resourceType é obrigatório.');
    }
    if (!props.ipAddress?.trim()) {
      throw new DomainException('AuditLog: ipAddress é obrigatório para rastreabilidade.');
    }
    if (!AuditLog.isValidIp(props.ipAddress)) {
      throw new DomainException(
        `AuditLog: ipAddress "${props.ipAddress}" não é um endereço IP válido (IPv4 ou IPv6).`,
      );
    }
    if (!(props.timestamp instanceof Date) || isNaN(props.timestamp.getTime())) {
      throw new DomainException('AuditLog: timestamp deve ser uma data válida.');
    }
  }

  /**
   * Validação básica de formato IP (IPv4 ou IPv6).
   * A validação completa de INET é feita pelo PostgreSQL na persistência.
   */
  private static isValidIp(ip: string): boolean {
    // IPv4: 0.0.0.0 a 255.255.255.255
    const IPv4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6: aceita formato completo ou comprimido (::1, etc.)
    const IPv6_REGEX = /^[0-9a-fA-F:]{2,39}$/;
    // Aceita também localhost e formatos internos comuns
    if (ip === '::1' || ip === 'localhost' || ip === '127.0.0.1') return true;
    return IPv4_REGEX.test(ip) || IPv6_REGEX.test(ip);
  }

  // ---------------------------------------------------------------------------
  // Factory (único ponto de criação — padrão Factory Method)
  // ---------------------------------------------------------------------------

  /**
   * Cria e retorna um novo AuditLog imutável.
   * O timestamp é sempre definido internamente como `new Date()`,
   * garantindo que o momento exato da ação seja registrado pelo servidor,
   * independente do relógio do cliente.
   *
   * @example
   * const log = AuditLog.criar({
   *   id: uuid(),
   *   userId: 'abc-123',
   *   actionType: 'DOWNLOAD',
   *   resourceType: 'DOCUMENT',
   *   documentId: 'doc-456',
   *   ipAddress: '192.168.1.1',
   *   userAgent: 'Mozilla/5.0...',
   *   detailsJson: { fileName: 'NF_2026.xml' },
   * });
   */
  static criar(
    props: Omit<AuditLogProps, 'timestamp'>,
  ): AuditLog {
    return new AuditLog({
      ...props,
      timestamp: new Date(),
    });
  }

  /**
   * Reconstitui um AuditLog a partir da persistência.
   * Preserva o timestamp original — não usa `new Date()`.
   */
  static reconstituir(props: AuditLogProps): AuditLog {
    return new AuditLog(props);
  }

  // ---------------------------------------------------------------------------
  // Getters (somente leitura — imutabilidade absoluta)
  // ---------------------------------------------------------------------------

  get id(): string { return this._props.id; }
  get documentId(): string | null { return this._props.documentId; }
  get userId(): string { return this._props.userId; }
  get actionType(): ActionType { return this._props.actionType; }
  get resourceType(): ResourceType { return this._props.resourceType; }
  get detailsJson(): Readonly<Record<string, unknown>> { return this._props.detailsJson; }
  get ipAddress(): string { return this._props.ipAddress; }
  get userAgent(): string | null { return this._props.userAgent; }
  get timestamp(): Date { return this._props.timestamp; }
}
