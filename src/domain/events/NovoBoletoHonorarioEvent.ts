import { randomUUID } from 'crypto';
import type { DomainEvent } from '../../shared/DomainEvent';

export class NovoBoletoHonorarioEvent implements DomainEvent {
  readonly eventId    = randomUUID();
  readonly eventName  = 'NovoBoletoHonorarioEvent' as const;
  readonly occurredAt = new Date();

  readonly mensagem: string;

  constructor(
    readonly boletoId:      string,
    readonly clienteId:     string,
    readonly mesReferencia: string,
    readonly valor:         number,
    readonly vencimento:    string,
  ) {
    this.mensagem = `Seu boleto de honorários de ${mesReferencia} (R$ ${valor.toFixed(2)}) já está disponível.`;
  }
}
