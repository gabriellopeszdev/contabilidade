import type { DomainEvent } from './DomainEvent';

/**
 * Classe base para Agregados DDD.
 *
 * Gerencia a coleção interna de Eventos de Domínio pendentes.
 * Os eventos são coletados pelas entidades via `addDomainEvent()` e
 * posteriormente publicados pelo `IEventDispatcher` na camada de aplicação,
 * mantendo o domínio completamente desacoplado da infraestrutura de mensageria.
 *
 * Padrão: os eventos são "puxados" (pull model) pelo Use Case após a operação,
 * garantindo que só sejam publicados se a transação persistir com sucesso.
 */
export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  /**
   * Registra um evento de domínio para publicação posterior.
   * Chamado internamente pelas subclasses (entidades) ao mudar de estado.
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Retorna e limpa os eventos acumulados.
   * Chamado pelo Use Case após persistência bem-sucedida.
   * O EventDispatcher os envia para os listeners registrados.
   */
  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  /** Apenas para inspeção/testes — não limpa a fila. */
  peekDomainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }
}
