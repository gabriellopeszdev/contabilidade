import { DomainException } from '../exceptions/DomainException';
import type { IPasswordHasher } from '../ports/IPasswordHasher';

/**
 * Value Object: SenhaHash
 *
 * Representa um hash de senha de forma segura na camada de domínio.
 *
 * INVARIANTES:
 * - Nunca armazena texto plano. O construtor privado aceita apenas hashes pré-computados.
 * - `toString()` retorna uma string ofuscada para prevenir vazamento acidental em logs.
 * - A lógica de hashing (bcrypt) é delegada para o `IPasswordHasher` (Port),
 *   mantendo o domínio livre de dependências de infraestrutura (DIP - SOLID).
 *
 * COMO USAR:
 * - Para criar a partir de texto plano (no use case): `SenhaHash.criarDeTextoPlano(senha, hasher)`
 * - Para reconstituir da persistência: `SenhaHash.fromHash(hashString)`
 * - Para comparar: `senhaHash.comparar(textoPlano, hasher)`
 */
export class SenhaHash {
  private readonly _hash: string;

  private constructor(hash: string) {
    if (!hash || hash.trim().length === 0) {
      throw new DomainException('Hash de senha inválido: não pode ser vazio.');
    }
    this._hash = hash;
  }

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  /**
   * Cria um SenhaHash a partir de texto plano.
   * Deve ser chamado APENAS na camada de aplicação (use cases), nunca no frontend.
   * O hashing real é executado pelo `IPasswordHasher` injetado (bcrypt na infra).
   */
  static async criarDeTextoPlano(
    senhaPlana: string,
    hasher: IPasswordHasher,
  ): Promise<SenhaHash> {
    if (!senhaPlana || senhaPlana.length < 8) {
      throw new DomainException(
        'Senha inválida: mínimo de 8 caracteres obrigatório.',
      );
    }
    const hash = await hasher.hash(senhaPlana);
    return new SenhaHash(hash);
  }

  /**
   * Reconstitui um SenhaHash a partir de um hash já armazenado (vindo do banco de dados).
   * NÃO valida o conteúdo do hash — assume que foi gerado corretamente pelo sistema.
   */
  static fromHash(hash: string): SenhaHash {
    return new SenhaHash(hash);
  }

  // ---------------------------------------------------------------------------
  // Interface pública
  // ---------------------------------------------------------------------------

  /**
   * Compara uma senha em texto plano com o hash armazenado.
   * Delega a comparação segura (timing-safe) ao `IPasswordHasher`.
   */
  async comparar(senhaPlana: string, hasher: IPasswordHasher): Promise<boolean> {
    return hasher.comparar(senhaPlana, this._hash);
  }

  /**
   * Retorna o hash para persistência.
   * Acesse apenas em adaptadores de repositório (camada de infraestrutura).
   */
  get hash(): string {
    return this._hash;
  }

  /** Previne vazamento do hash em logs, `console.log` e serialização acidental. */
  toString(): string {
    return '[SENHA_HASH_PROTEGIDO]';
  }

  toJSON(): string {
    return '[SENHA_HASH_PROTEGIDO]';
  }
}
