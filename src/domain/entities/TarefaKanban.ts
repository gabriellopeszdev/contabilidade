import { AggregateRoot } from '../../shared/AggregateRoot';
import type { DomainEvent } from '../../shared/DomainEvent';
import { DomainException } from '../exceptions/DomainException';
import { InvalidTransitionException } from '../exceptions/InvalidTransitionException';

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

export type EstadoTarefa = 'PENDING' | 'PROCESSING' | 'REVIEW' | 'DONE';
export type PrioridadeTarefa = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TarefaKanbanProps {
  id: string;
  clientId: string;
  assignedTo: string | null;
  title: string;
  description: string | null;
  currentState: EstadoTarefa;
  priority: PrioridadeTarefa;
  dueDate: Date | null;
  completedAt: Date | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// State Machine — Grafo de Transições Válidas
// ---------------------------------------------------------------------------

/**
 * Define as transições de estado permitidas pelo ciclo de vida de uma TarefaKanban.
 * Transições não presentes neste mapa são INVÁLIDAS e lançam InvalidTransitionException.
 *
 * Fluxo principal: PENDING → PROCESSING → REVIEW → DONE
 * Retrabalho:      REVIEW → PROCESSING (tarefa rejeitada, volta para execução)
 * Reabertura:      PROCESSING → PENDING (tarefa pausada antes do início efetivo)
 */
const TRANSICOES_VALIDAS: Readonly<Record<EstadoTarefa, ReadonlyArray<EstadoTarefa>>> = {
  PENDING:    ['PROCESSING'],
  PROCESSING: ['REVIEW', 'PENDING'],
  REVIEW:     ['DONE', 'PROCESSING'],
  DONE:       [], // estado terminal — nenhuma transição permitida
} as const;

// ---------------------------------------------------------------------------
// Evento de domínio (placeholder — implementado em src/domain/events/)
// ---------------------------------------------------------------------------

interface TarefaTransitadaPayload extends DomainEvent {
  tarefaId: string;
  estadoAnterior: EstadoTarefa;
  novoEstado: EstadoTarefa;
  contadorId: string | null;
}

// ---------------------------------------------------------------------------
// Entidade Rica: TarefaKanban
// ---------------------------------------------------------------------------

/**
 * Entidade Rica: TarefaKanban
 *
 * Representa um card no quadro Kanban do escritório contábil.
 * Segue o padrão State Machine com transições validadas em cada mudança de coluna.
 *
 * ESTADO MUTÁVEL: currentState, assignedTo, priority, dueDate, completedAt, position, updatedAt.
 * ESTADO IMUTÁVEL: id, clientId, createdAt.
 *
 * Métodos públicos de negócio:
 *   - transitar(novoEstado): transiciona o estado validando o grafo
 *   - validarTransicao(novoEstado): verifica sem efetuar a transição
 *   - atribuirResponsavel(contadorId): designa um contador responsável
 */
export class TarefaKanban extends AggregateRoot {
  private _currentState: EstadoTarefa;
  private _assignedTo: string | null;
  private _priority: PrioridadeTarefa;
  private _dueDate: Date | null;
  private _completedAt: Date | null;
  private _position: number;
  private _updatedAt: Date;

  private constructor(private readonly _props: TarefaKanbanProps) {
    super();
    TarefaKanban.validarProps(_props);

    this._currentState = _props.currentState;
    this._assignedTo = _props.assignedTo;
    this._priority = _props.priority;
    this._dueDate = _props.dueDate;
    this._completedAt = _props.completedAt;
    this._position = _props.position;
    this._updatedAt = _props.updatedAt;
  }

  // ---------------------------------------------------------------------------
  // Validação de invariantes
  // ---------------------------------------------------------------------------

  private static validarProps(props: TarefaKanbanProps): void {
    if (!props.id?.trim()) {
      throw new DomainException('TarefaKanban: ID é obrigatório.');
    }
    if (!props.clientId?.trim()) {
      throw new DomainException('TarefaKanban: clientId é obrigatório.');
    }
    if (!props.title?.trim()) {
      throw new DomainException('TarefaKanban: título é obrigatório.');
    }
    if (props.title.length > 255) {
      throw new DomainException('TarefaKanban: título excede 255 caracteres.');
    }
    if (props.position < 0) {
      throw new DomainException('TarefaKanban: posição não pode ser negativa.');
    }
    if (!TRANSICOES_VALIDAS[props.currentState]) {
      throw new DomainException(`TarefaKanban: estado inicial inválido "${props.currentState}".`);
    }
  }

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  static criar(
    props: Pick<TarefaKanbanProps, 'id' | 'clientId' | 'title' | 'description' | 'priority' | 'dueDate' | 'position'>,
  ): TarefaKanban {
    const now = new Date();
    return new TarefaKanban({
      ...props,
      assignedTo: null,
      currentState: 'PENDING',
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstituir(props: TarefaKanbanProps): TarefaKanban {
    return new TarefaKanban(props);
  }

  // ---------------------------------------------------------------------------
  // Métodos de negócio — State Machine
  // ---------------------------------------------------------------------------

  /**
   * Verifica se a transição para `novoEstado` é permitida pelo grafo de estados.
   * NÃO altera o estado — use este método para validação prévia ou testes.
   *
   * @returns `true` se a transição é válida, `false` caso contrário.
   */
  validarTransicao(novoEstado: EstadoTarefa): boolean {
    const transicoesPermitidas = TRANSICOES_VALIDAS[this._currentState];
    return transicoesPermitidas.includes(novoEstado);
  }

  /**
   * Transiciona a tarefa para `novoEstado`.
   * Lança `InvalidTransitionException` se a transição não for permitida.
   * Emite `TarefaTransitadaEvent` após transição bem-sucedida.
   *
   * Efeitos colaterais:
   *   - Estado DONE: registra `completedAt` com o timestamp atual.
   *   - Estado PENDING (reabertura): limpa `completedAt`.
   */
  transitar(novoEstado: EstadoTarefa): void {
    if (!this.validarTransicao(novoEstado)) {
      throw new InvalidTransitionException(this._currentState, novoEstado);
    }

    const estadoAnterior = this._currentState;
    this._currentState = novoEstado;
    this._updatedAt = new Date();

    // Efeitos colaterais do estado final
    if (novoEstado === 'DONE') {
      this._completedAt = new Date();
    } else if (estadoAnterior === 'DONE') {
      // Reabertura de tarefa (improvável pelo grafo atual, mas defensivo)
      this._completedAt = null;
    }

    // Emite evento para listeners (WebSocket, auditoria, notificações)
    const evento: TarefaTransitadaPayload = {
      eventId: crypto.randomUUID(),
      eventName: 'TarefaTransitadaEvent',
      occurredAt: new Date(),
      tarefaId: this._props.id,
      estadoAnterior,
      novoEstado,
      contadorId: this._assignedTo,
    };
    this.addDomainEvent(evento);
  }

  // ---------------------------------------------------------------------------
  // Métodos de negócio — Atribuição e Organização
  // ---------------------------------------------------------------------------

  /**
   * Designa um contador como responsável pela execução desta tarefa.
   * Lança `DomainException` se a tarefa já estiver concluída (DONE).
   *
   * @param contadorId UUID do UsuarioContador responsável.
   */
  atribuirResponsavel(contadorId: string): void {
    if (this._currentState === 'DONE') {
      throw new DomainException(
        'Não é possível atribuir responsável a uma tarefa já concluída.',
      );
    }

    if (!contadorId?.trim()) {
      throw new DomainException('TarefaKanban: contadorId inválido para atribuição.');
    }

    this._assignedTo = contadorId;
    this._updatedAt = new Date();
  }

  /**
   * Remove a atribuição de responsável.
   */
  removerResponsavel(): void {
    this._assignedTo = null;
    this._updatedAt = new Date();
  }

  /**
   * Atualiza a posição do card na coluna (drag-and-drop).
   * A reordenação completa da coluna é feita no use case.
   */
  atualizarPosicao(novaPosicao: number): void {
    if (novaPosicao < 0) {
      throw new DomainException('TarefaKanban: posição não pode ser negativa.');
    }
    this._position = novaPosicao;
    this._updatedAt = new Date();
  }

  /**
   * Retorna as transições de estado que estão disponíveis a partir do estado atual.
   * Útil para o front-end renderizar apenas as ações válidas.
   */
  transicoesDisponiveis(): ReadonlyArray<EstadoTarefa> {
    return TRANSICOES_VALIDAS[this._currentState];
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get id(): string { return this._props.id; }
  get clientId(): string { return this._props.clientId; }
  get title(): string { return this._props.title; }
  get description(): string | null { return this._props.description; }
  get currentState(): EstadoTarefa { return this._currentState; }
  get assignedTo(): string | null { return this._assignedTo; }
  get priority(): PrioridadeTarefa { return this._priority; }
  get dueDate(): Date | null { return this._dueDate; }
  get completedAt(): Date | null { return this._completedAt; }
  get position(): number { return this._position; }
  get createdAt(): Date { return this._props.createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  get estaConcluida(): boolean { return this._currentState === 'DONE'; }
  get estaAtrasada(): boolean {
    return this._dueDate !== null && new Date() > this._dueDate && !this.estaConcluida;
  }
}
