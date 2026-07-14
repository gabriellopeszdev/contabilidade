import { randomUUID } from 'crypto';
import type { DomainEvent } from '../../shared/DomainEvent';

export class NovoComunicadoEvent implements DomainEvent {
  readonly eventId    = randomUUID();
  readonly eventName  = 'NovoComunicadoEvent' as const;
  readonly occurredAt = new Date();

  constructor(
    readonly comunicadoId: string,
    readonly titulo:       string,
    readonly contadorNome: string,
    readonly clienteIds:   string[],
  ) {}
}
