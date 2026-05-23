import { DomainException } from './DomainException';

export class InvalidTransitionException extends DomainException {
  constructor(estadoAtual: string, estadoDesejado: string) {
    super(
      `Transição de estado inválida: "${estadoAtual}" → "${estadoDesejado}". ` +
        `Esta transição não é permitida pelo ciclo de vida da entidade.`,
    );
    this.name = 'InvalidTransitionException';
    Object.setPrototypeOf(this, InvalidTransitionException.prototype);
  }
}
