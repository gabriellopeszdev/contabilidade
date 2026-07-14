import { randomUUID } from 'crypto';
import type { DomainEvent } from '../../shared/DomainEvent';

export class ClienteAtivadoEvent implements DomainEvent {
  readonly eventId    = randomUUID();
  readonly eventName  = 'ClienteAtivadoEvent' as const;
  readonly occurredAt = new Date();

  constructor(
    readonly clienteId:  string,
    readonly contadorId: string,
  ) {}
}
