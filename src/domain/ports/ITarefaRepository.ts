import type { TarefaKanban, EstadoTarefa, PrioridadeTarefa } from '../entities/TarefaKanban';
import type { PaginacaoParams, ResultadoPaginado } from '../../shared/PaginationHelper';

// ---------------------------------------------------------------------------
// Tipos de filtro
// ---------------------------------------------------------------------------

export interface FiltroTarefa {
  clienteId?: string;
  assignedTo?: string;
  currentState?: EstadoTarefa;
  priority?: PrioridadeTarefa;
  /** Filtra tarefas com prazo vencido (due_date < NOW() e not DONE). */
  apenasAtrasadas?: boolean;
}

// ---------------------------------------------------------------------------
// Contrato: ITarefaRepository
// ---------------------------------------------------------------------------

/**
 * Port (interface) para persistência de TarefaKanban.
 *
 * DESIGN:
 *   - `reordenar()` é uma operação batch que atualiza o campo `position` de
 *     múltiplos cards de uma vez, executada em transação única (drag-and-drop).
 *   - Não há soft delete para tarefas — a remoção é permanente (DELETE físico).
 *     Tarefas concluídas (DONE) são mantidas por histórico.
 */
export interface ITarefaRepository {
  /**
   * Persiste uma nova TarefaKanban.
   */
  salvar(tarefa: TarefaKanban): Promise<void>;

  /**
   * Busca uma TarefaKanban pelo ID.
   * Retorna `null` se não encontrada.
   */
  buscarPorId(id: string): Promise<TarefaKanban | null>;

  /**
   * Lista tarefas com filtros e paginação.
   * Resultado ordenado por `position ASC` dentro de cada `currentState`.
   */
  listar(
    filtros?: FiltroTarefa,
    paginacao?: PaginacaoParams,
  ): Promise<ResultadoPaginado<TarefaKanban>>;

  /**
   * Persiste as alterações de uma TarefaKanban existente.
   * Usado após transições de estado, atribuição de responsável, etc.
   */
  atualizar(tarefa: TarefaKanban): Promise<void>;

  /**
   * Atualiza a posição (`position`) de múltiplos cards em uma transação única.
   * Chamado após operação de drag-and-drop no front-end.
   *
   * @param reordenacao Array de { id, position } para atualização em lote.
   */
  reordenar(reordenacao: Array<{ id: string; position: number }>): Promise<void>;

  /**
   * Remove permanentemente uma TarefaKanban.
   * Permitido apenas para ACCOUNTANTs (verificado no RBAC middleware).
   */
  deletar(id: string): Promise<void>;
}
