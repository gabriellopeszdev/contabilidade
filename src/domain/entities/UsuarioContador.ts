import { AggregateRoot } from '../../shared/AggregateRoot';
import { DomainException } from '../exceptions/DomainException';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import { Email } from '../value-objects/Email';
import { CRC } from '../value-objects/CRC';
import { SenhaHash } from '../value-objects/SenhaHash';

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

export interface UsuarioContadorProps {
  id: string;
  name: string;
  email: Email;
  passwordHash: SenhaHash;
  crc: CRC | null;
  clienteIds: string[];
  phone: string | null;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Entidade Rica: UsuarioContador
// ---------------------------------------------------------------------------

/**
 * Entidade Rica: UsuarioContador
 *
 * Representa o profissional de contabilidade responsável por N clientes.
 * Possui acesso completo aos documentos, Kanban e operações de upload
 * de todos os clientes associados à sua carteira.
 *
 * PAPEL (role): ACCOUNTANT — acessa documentos e tarefas dos seus clientes.
 *
 * ESTADO MUTÁVEL: clienteIds (carteira de clientes), lastLoginAt, isActive,
 *                 passwordHash, phone, avatarUrl, updatedAt.
 * ESTADO IMUTÁVEL: id, email, crc, createdAt.
 *
 * Métodos públicos de negócio:
 *   - associarCliente(clienteId): adiciona cliente à carteira (idempotente)
 *   - desassociarCliente(clienteId): remove cliente da carteira
 *   - listarClientesAtivos(): retorna IDs dos clientes na carteira atual
 *   - autenticar(senhaPlana, hasher): valida credenciais
 *   - alterarSenha(novaSenhaHash): substitui o hash de senha
 */
export class UsuarioContador extends AggregateRoot {
  private _clienteIds: Set<string>;
  private _passwordHash: SenhaHash;
  private _lastLoginAt: Date | null;
  private _isActive: boolean;
  private _phone: string | null;
  private _avatarUrl: string | null;
  private _updatedAt: Date;

  private constructor(private readonly _props: UsuarioContadorProps) {
    super();
    UsuarioContador.validarProps(_props);

    this._clienteIds = new Set(_props.clienteIds);
    this._passwordHash = _props.passwordHash;
    this._lastLoginAt = _props.lastLoginAt;
    this._isActive = _props.isActive;
    this._phone = _props.phone;
    this._avatarUrl = _props.avatarUrl;
    this._updatedAt = _props.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // Validação de invariantes
  // ---------------------------------------------------------------------------

  private static validarProps(props: UsuarioContadorProps): void {
    if (!props.id?.trim()) {
      throw new DomainException('UsuarioContador: ID é obrigatório.');
    }
    if (!props.name?.trim()) {
      throw new DomainException('UsuarioContador: nome é obrigatório.');
    }
    if (props.name.length > 255) {
      throw new DomainException('UsuarioContador: nome excede 255 caracteres.');
    }
  }

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  static criar(
    props: Omit<UsuarioContadorProps, 'clienteIds' | 'lastLoginAt' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): UsuarioContador {
    const now = new Date();
    return new UsuarioContador({
      ...props,
      clienteIds: [],
      lastLoginAt: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstituir(props: UsuarioContadorProps): UsuarioContador {
    return new UsuarioContador(props);
  }

  // ---------------------------------------------------------------------------
  // Métodos de negócio — Gestão de Carteira de Clientes
  // ---------------------------------------------------------------------------

  /**
   * Associa um cliente à carteira do contador.
   * Idempotente: não lança erro se o cliente já estiver associado.
   *
   * @param clienteId UUID do UsuarioCliente a ser associado.
   */
  associarCliente(clienteId: string): void {
    if (!clienteId?.trim()) {
      throw new DomainException('UsuarioContador: clienteId inválido para associação.');
    }

    if (this._clienteIds.has(clienteId)) {
      return; // Idempotente — sem efeito colateral em duplicidade
    }

    this._clienteIds.add(clienteId);
    this._updatedAt = new Date();
  }

  /**
   * Remove um cliente da carteira do contador.
   * Lança `DomainException` se o cliente não estiver associado.
   * Para offboarding completo, use `EncerrarContratoClienteUseCase`.
   *
   * @param clienteId UUID do UsuarioCliente a ser removido.
   */
  desassociarCliente(clienteId: string): void {
    if (!clienteId?.trim()) {
      throw new DomainException('UsuarioContador: clienteId inválido para desassociação.');
    }

    if (!this._clienteIds.has(clienteId)) {
      throw new DomainException(
        `Cliente "${clienteId}" não está associado a este contador.`,
      );
    }

    this._clienteIds.delete(clienteId);
    this._updatedAt = new Date();
  }

  /**
   * Retorna a lista imutável de IDs dos clientes atualmente na carteira.
   * "Ativos" aqui significa "associados a este contador". O status `isActive`
   * do UsuarioCliente individual é verificado na camada de aplicação.
   *
   * @returns Array somente-leitura com os UUIDs dos clientes.
   */
  listarClientesAtivos(): ReadonlyArray<string> {
    return [...this._clienteIds];
  }

  /**
   * Verifica se um cliente específico está associado a este contador.
   * Útil para o middleware RBAC validar ownership antes de expor documentos.
   */
  possuiCliente(clienteId: string): boolean {
    return this._clienteIds.has(clienteId);
  }

  // ---------------------------------------------------------------------------
  // Métodos de negócio — Autenticação
  // ---------------------------------------------------------------------------

  /**
   * Valida as credenciais do contador.
   * Lança `DomainException` se a conta estiver inativa.
   * Atualiza `lastLoginAt` em caso de sucesso.
   */
  async autenticar(
    senhaPlana: string,
    hasher: IPasswordHasher,
  ): Promise<boolean> {
    if (!this._isActive) {
      throw new DomainException(
        'Conta de contador inativa. Entre em contato com o administrador do sistema.',
      );
    }

    const senhaValida = await this._passwordHash.comparar(senhaPlana, hasher);

    if (senhaValida) {
      this._lastLoginAt = new Date();
      this._updatedAt = new Date();
    }

    return senhaValida;
  }

  /**
   * Substitui o hash de senha do contador.
   */
  alterarSenha(novaSenhaHash: SenhaHash): void {
    this._passwordHash = novaSenhaHash;
    this._updatedAt = new Date();
  }

  desativar(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get id(): string { return this._props.id; }
  get name(): string { return this._props.name; }
  get email(): Email { return this._props.email; }
  get passwordHash(): SenhaHash { return this._passwordHash; }
  get crc(): CRC | null { return this._props.crc; }
  get phone(): string | null { return this._phone; }
  get avatarUrl(): string | null { return this._avatarUrl; }
  get lastLoginAt(): Date | null { return this._lastLoginAt; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get deletedAt(): Date | null { return this._props.deletedAt; }

  /** Número total de clientes na carteira. */
  get totalClientes(): number { return this._clienteIds.size; }

  get role(): 'ACCOUNTANT' { return 'ACCOUNTANT'; }
}
