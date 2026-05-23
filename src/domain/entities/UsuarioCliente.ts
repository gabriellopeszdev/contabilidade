import { AggregateRoot } from '../../shared/AggregateRoot';
import { DomainException } from '../exceptions/DomainException';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import { Email } from '../value-objects/Email';
import { CNPJ } from '../value-objects/CNPJ';
import { SenhaHash } from '../value-objects/SenhaHash';

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

/**
 * Recursos do sistema que um CLIENT pode ou não acessar.
 * Extendível à medida que novas funcionalidades forem adicionadas.
 */
export type RecursoCliente =
  | 'DOCUMENTO_VISUALIZAR'
  | 'DOCUMENTO_DOWNLOAD'
  | 'PERFIL_EDITAR'
  | 'LGPD_EXPORTAR_DADOS'
  | 'LGPD_SOLICITAR_ANONIMIZACAO'
  | 'LGPD_REVOGAR_CONSENTIMENTO';

export interface UsuarioClienteProps {
  id: string;
  name: string;
  email: Email;
  passwordHash: SenhaHash;
  cnpj: CNPJ;
  phone: string | null;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Permissões do papel CLIENT (imutável — definido pela regra de negócio)
// ---------------------------------------------------------------------------

const PERMISSOES_CLIENT: ReadonlySet<RecursoCliente> = new Set<RecursoCliente>([
  'DOCUMENTO_VISUALIZAR',
  'DOCUMENTO_DOWNLOAD',
  'PERFIL_EDITAR',
  'LGPD_EXPORTAR_DADOS',
  'LGPD_SOLICITAR_ANONIMIZACAO',
  'LGPD_REVOGAR_CONSENTIMENTO',
]);

// ---------------------------------------------------------------------------
// Entidade Rica: UsuarioCliente
// ---------------------------------------------------------------------------

/**
 * Entidade Rica: UsuarioCliente
 *
 * Representa um usuário do tipo CLIENT no sistema — tipicamente o responsável
 * financeiro/fiscal de uma empresa atendida pelo escritório contábil.
 *
 * PAPEL (role): CLIENT — acessa apenas seus próprios documentos fiscais.
 * Não possui acesso ao Kanban nem ao upload de documentos.
 *
 * ESTADO MUTÁVEL: lastLoginAt, isActive, passwordHash, phone, avatarUrl, updatedAt.
 * ESTADO IMUTÁVEL: id, email (identificador de login), cnpj, createdAt.
 *
 * Métodos públicos de negócio:
 *   - autenticar(senhaPlana, hasher): valida credenciais e atualiza lastLoginAt
 *   - alterarSenha(novaSenhaHash): substitui o hash de senha
 *   - verificarPermissao(recurso): verifica se o role CLIENT pode acessar o recurso
 */
export class UsuarioCliente extends AggregateRoot {
  private _passwordHash: SenhaHash;
  private _lastLoginAt: Date | null;
  private _isActive: boolean;
  private _phone: string | null;
  private _avatarUrl: string | null;
  private _updatedAt: Date;

  private constructor(private readonly _props: UsuarioClienteProps) {
    super();
    UsuarioCliente.validarProps(_props);

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

  private static validarProps(props: UsuarioClienteProps): void {
    if (!props.id?.trim()) {
      throw new DomainException('UsuarioCliente: ID é obrigatório.');
    }
    if (!props.name?.trim()) {
      throw new DomainException('UsuarioCliente: nome é obrigatório.');
    }
    if (props.name.length > 255) {
      throw new DomainException('UsuarioCliente: nome excede 255 caracteres.');
    }
  }

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  static criar(props: Omit<UsuarioClienteProps, 'lastLoginAt' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'>): UsuarioCliente {
    const now = new Date();
    return new UsuarioCliente({
      ...props,
      lastLoginAt: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstituir(props: UsuarioClienteProps): UsuarioCliente {
    return new UsuarioCliente(props);
  }

  // ---------------------------------------------------------------------------
  // Métodos de negócio
  // ---------------------------------------------------------------------------

  /**
   * Valida as credenciais do usuário.
   * Lança `DomainException` se a conta estiver inativa.
   * Atualiza `lastLoginAt` em caso de sucesso.
   * A comparação real da senha é delegada ao `IPasswordHasher` (bcrypt na infra).
   *
   * @returns `true` se senha correta, `false` se senha incorreta.
   */
  async autenticar(
    senhaPlana: string,
    hasher: IPasswordHasher,
  ): Promise<boolean> {
    if (!this._isActive) {
      throw new DomainException(
        'Conta inativa. Entre em contato com o escritório contábil para reativação.',
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
   * Substitui o hash de senha do usuário.
   * A geração do novo hash deve ser feita na camada de aplicação (use case)
   * via `SenhaHash.criarDeTextoPlano(novaSenha, hasher)`.
   */
  alterarSenha(novaSenhaHash: SenhaHash): void {
    this._passwordHash = novaSenhaHash;
    this._updatedAt = new Date();
  }

  /**
   * Verifica se o role CLIENT possui permissão para acessar o recurso especificado.
   * A verificação de ownership (se o documento pertence ao cliente) é responsabilidade
   * do middleware RBAC na camada de infraestrutura.
   */
  verificarPermissao(recurso: RecursoCliente): boolean {
    return PERMISSOES_CLIENT.has(recurso);
  }

  /** Desativa a conta sem excluí-la (soft delete lógico de acesso). */
  desativar(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /** Reativa uma conta desativada. */
  reativar(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get id(): string { return this._props.id; }
  get name(): string { return this._props.name; }
  get email(): Email { return this._props.email; }
  get passwordHash(): SenhaHash { return this._passwordHash; }
  get cnpj(): CNPJ { return this._props.cnpj; }
  get phone(): string | null { return this._phone; }
  get avatarUrl(): string | null { return this._avatarUrl; }
  get lastLoginAt(): Date | null { return this._lastLoginAt; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get deletedAt(): Date | null { return this._props.deletedAt; }

  /** Papel fixo — CLIENTs são sempre CLIENT. */
  get role(): 'CLIENT' { return 'CLIENT'; }
}
