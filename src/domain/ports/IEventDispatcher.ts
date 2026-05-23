import type { DomainEvent } from '../../shared/DomainEvent';

// ---------------------------------------------------------------------------
// Contrato: IEventDispatcher
// ---------------------------------------------------------------------------

/**
 * Port (interface) para publicação de Eventos de Domínio.
 *
 * Implementa o padrão Observer desacoplado: o domínio e a aplicação
 * apenas publicam eventos sem conhecer os listeners.
 *
 * IMPLEMENTAÇÕES ESPERADAS:
 *   - `InMemoryEventDispatcher`: Para testes e ambiente de desenvolvimento.
 *     Executa listeners de forma síncrona no mesmo processo.
 *   - `RabbitMQEventDispatcher` (futuro): Para ambiente multi-instância.
 *     Publica eventos em fila; listeners executam de forma assíncrona.
 *
 * DESIGN:
 *   - `dispatch()` deve ser chamado pelo Use Case APÓS a persistência bem-sucedida.
 *     Nunca antes — um evento publicado antes do commit pode referenciar dados
 *     que foram revertidos (phantom events).
 *   - `dispatchAll()` é o método principal — use cases chamam
 *     `aggregate.pullDomainEvents()` e passam o array resultante.
 *   - Falhas no dispatch NÃO devem reverter a operação já persistida.
 *     O sistema de notificação é eventually consistent por design.
 *
 * FLUXO PADRÃO NO USE CASE:
 * ```
 * await repositorio.atualizar(entidade);          // 1. Persiste
 * const eventos = entidade.pullDomainEvents();     // 2. Coleta eventos
 * await eventDispatcher.dispatchAll(eventos);      // 3. Publica
 * ```
 */
export interface IEventDispatcher {
  /**
   * Publica um único evento de domínio para todos os listeners registrados.
   * Falhas no processamento dos listeners devem ser logadas, não propagadas.
   */
  dispatch(event: DomainEvent): Promise<void>;

  /**
   * Publica múltiplos eventos em ordem de ocorrência.
   * Use este método com os eventos coletados via `aggregate.pullDomainEvents()`.
   * Garante a ordem de publicação respeitando a sequência de eventos do agregado.
   */
  dispatchAll(events: DomainEvent[]): Promise<void>;
}
