import type { Redis } from 'ioredis';
import type { DomainEvent } from '../../shared/DomainEvent';
import type { IEventDispatcher } from '../../domain/ports/IEventDispatcher';
import type { ILogger } from '../../domain/ports/ILogger';

// =============================================================================
// Canal Redis para eventos de domínio
//
// Exportado para ser importado pelo SocketServer.ts (subscriber) e pelo
// Container.ts (publisher). Centralizar o nome do canal evita typos e
// facilita a busca por "quem publica" e "quem consome" este canal.
// =============================================================================

export const REDIS_DOMAIN_EVENTS_CHANNEL =
  'contabilidade:domain:events' as const;

// =============================================================================
// RedisEventDispatcher
//
// Implementação de IEventDispatcher que publica eventos no canal Redis via
// Pub/Sub. O SocketServer.ts assina esse canal com uma conexão dedicada
// de subscriber e encaminha para os clientes WebSocket corretos.
//
// IMPORTANTE — Redis Pub/Sub:
//   - Uma conexão Redis em modo SUBSCRIBE só pode executar comandos de pub/sub.
//   - Esta classe usa PUBLISH, que exige uma conexão regular (não subscriber).
//   - Por isso, o Container instancia TWO conexões Redis separadas:
//       1. redisPublisher  → injetado aqui (executa PUBLISH)
//       2. redisSubscriber → injetado no SocketServer (executa SUBSCRIBE)
//
// FALHA NO DISPATCH:
//   - Falhas são logadas mas NÃO propagadas para o use case.
//   - Notificações são eventually consistent por design (ADR-010).
//   - O AuditLog já persiste o evento antes do dispatch, então a operação
//     principal nunca é revertida por falha no dispatcher.
// =============================================================================

export class RedisEventDispatcher implements IEventDispatcher {
  constructor(
    private readonly redis: Redis,
    private readonly logger: ILogger,
  ) {}

  async dispatch(event: DomainEvent): Promise<void> {
    try {
      // JSON.stringify serializa todas as propriedades enumeráveis do objeto.
      // Para classes com getters (ex: NovoDocumentoUploadEvent.sucesso),
      // apenas as propriedades de instância são incluídas — os getters
      // computados são recalculados no SocketServer a partir dos dados brutos.
      await this.redis.publish(
        REDIS_DOMAIN_EVENTS_CHANNEL,
        JSON.stringify(event),
      );
    } catch (err) {
      this.logger.warn(
        `[RedisEventDispatcher] Falha ao publicar "${event.eventName}"`,
        { eventId: event.eventId, error: err instanceof Error ? err.message : String(err) },
      );
    }
  }

  async dispatchAll(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    // allSettled: publica todos os eventos independente de falhas individuais.
    // Falhas são logadas por `dispatch()`, sem interromper os demais.
    await Promise.allSettled(events.map((e) => this.dispatch(e)));
  }
}
