import type { UsuarioCliente } from '../entities/UsuarioCliente';
import type { UsuarioContador } from '../entities/UsuarioContador';
import type { Email } from '../value-objects/Email';

// ---------------------------------------------------------------------------
// Union type para retorno polimórfico
// ---------------------------------------------------------------------------

export type UsuarioSistema = UsuarioCliente | UsuarioContador;

// ---------------------------------------------------------------------------
// Contrato: IUsuarioRepository
// ---------------------------------------------------------------------------

/**
 * Port (interface) para persistência de usuários do sistema.
 *
 * A tabela `users` é polimórfica — armazena CLIENTs, ACCOUNTANTs e ADMINs
 * discriminados pelo campo `role`. Este repositório expõe métodos tipados
 * para cada categoria, evitando type assertions espalhadas na aplicação.
 *
 * DESIGN:
 *   - Métodos segregados por tipo garantem tipagem forte no retorno.
 *   - `buscarPorEmail` retorna union type pois o email é único entre todos os roles.
 *   - Soft delete gerenciado via `deleted_at` e `is_active`.
 *   - Unicidade de `email` e `document_id` garantida por constraints no banco.
 */
export interface IUsuarioRepository {
  // ---------------------------------------------------------------------------
  // Operações — UsuarioCliente (role = CLIENT)
  // ---------------------------------------------------------------------------

  /**
   * Persiste um novo UsuarioCliente.
   * Lança erro se email ou CNPJ já existirem (UNIQUE constraint).
   */
  salvarCliente(cliente: UsuarioCliente): Promise<void>;

  /**
   * Busca um UsuarioCliente pelo ID.
   * Retorna `null` se não encontrado, se soft-deleted ou se o role não for CLIENT.
   */
  buscarClientePorId(id: string): Promise<UsuarioCliente | null>;

  /**
   * Lista todos os CLIENTs associados a um contador específico.
   * Resultado não paginado — usado para operações em lote (offboarding, relatórios).
   */
  listarClientesPorContador(contadorId: string): Promise<UsuarioCliente[]>;

  /**
   * Persiste alterações de um UsuarioCliente existente.
   */
  atualizarCliente(cliente: UsuarioCliente): Promise<void>;

  // ---------------------------------------------------------------------------
  // Operações — UsuarioContador (role = ACCOUNTANT)
  // ---------------------------------------------------------------------------

  /**
   * Persiste um novo UsuarioContador.
   * Lança erro se email ou CRC já existirem (UNIQUE constraint).
   */
  salvarContador(contador: UsuarioContador): Promise<void>;

  /**
   * Busca um UsuarioContador pelo ID.
   * Retorna `null` se não encontrado, se soft-deleted ou se o role não for ACCOUNTANT.
   */
  buscarContadorPorId(id: string): Promise<UsuarioContador | null>;

  /**
   * Persiste alterações de um UsuarioContador existente.
   * Inclui atualização da lista de clientes associados.
   */
  atualizarContador(contador: UsuarioContador): Promise<void>;

  // ---------------------------------------------------------------------------
  // Operações — Polimórficas (qualquer role)
  // ---------------------------------------------------------------------------

  /**
   * Busca qualquer usuário pelo e-mail de login.
   * Retorna `null` se não encontrado ou soft-deleted.
   * Usado no fluxo de autenticação (`AutenticarUsuarioUseCase`).
   */
  buscarPorEmail(email: Email): Promise<UsuarioSistema | null>;

  /**
   * Verifica se um e-mail já está cadastrado no sistema (qualquer role).
   * Mais eficiente que `buscarPorEmail` para validação de unicidade no cadastro.
   */
  emailJaExiste(email: Email): Promise<boolean>;

  /**
   * Verifica se um documento fiscal (CPF/CNPJ/CRC) já está cadastrado.
   * Usado para validar unicidade em `CriarUsuarioUseCase`.
   */
  documentoJaExiste(documentoId: string): Promise<boolean>;

  /**
   * Soft delete de qualquer usuário (define `deleted_at` e `is_active = FALSE`).
   * Apenas ADMINs podem executar (verificado no RBAC middleware).
   */
  deletar(id: string): Promise<void>;
}
