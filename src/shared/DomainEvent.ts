/**
 * Interface base para todos os Eventos de Domínio do sistema.
 *
 * Eventos de Domínio representam fatos imutáveis que ocorreram no passado.
 * São gerados pelas Entidades/Agregados e consumidos por Listeners na camada
 * de infraestrutura (WebSocket, auditoria, e-mail, etc.) sem acoplar o domínio.
 *
 * O payload específico de cada evento é definido nas classes concretas em
 * `src/domain/events/`.
 */
export interface DomainEvent {
  /** Identificador único do evento (UUID v4). */
  readonly eventId: string;
  /** Nome canônico do evento (ex: 'DocumentoVisualizadoEvent'). */
  readonly eventName: string;
  /** Momento exato em que o evento ocorreu (imutável). */
  readonly occurredAt: Date;
}
