import type { DomainEvent } from '../../shared/DomainEvent';

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export interface DocumentoVisualizadoPayload {
  /** ID do documento visualizado/baixado. */
  readonly documentoId: string;
  /** ID do cliente dono do documento. */
  readonly clienteId: string;
  /**
   * ID do contador responsável pelo cliente.
   * Nulo se o próprio cliente visualizou (role = CLIENT).
   */
  readonly contadorResponsavelId: string | null;
  /** IP do cliente que realizou a ação (para notificação ao contador). */
  readonly ipAddress: string;
  /** Nome do arquivo (para mensagem de notificação amigável). */
  readonly nomeArquivo: string;
  /** Setor do documento (FISCAL, PESSOAL, CONTABIL). */
  readonly sector: string;
  /** ID de quem visualizou o documento. */
  readonly visualizadoPorId: string;
  /** Role de quem visualizou (CLIENT, ACCOUNTANT, ADMIN). */
  readonly visualizadoPorRole: 'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
}

// ---------------------------------------------------------------------------
// Evento de Domínio: DocumentoVisualizadoEvent
// ---------------------------------------------------------------------------

/**
 * Evento de Domínio: DocumentoVisualizadoEvent
 *
 * Disparado quando um cliente visualiza ou baixa um documento pela primeira vez.
 * Implementa a interface `DomainEvent` para compatibilidade com `IEventDispatcher`.
 *
 * LISTENERS QUE CONSOMEM ESTE EVENTO:
 *   - WebSocket Notification Handler: notifica o contador responsável em tempo real.
 *   - AuditLog Handler: persiste o registro via `IAuditLogRepository` (se não feito no UC).
 *
 * PAYLOAD INTENCIONAL:
 *   - Contém apenas IDs e metadados leves — sem entidades completas.
 *   - O listener busca dados adicionais se precisar (ex: nome do cliente).
 *   - Evita serialização de objetos complexos em filas de mensagens.
 */
export class DocumentoVisualizadoEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventName = 'DocumentoVisualizadoEvent' as const;
  readonly occurredAt: Date;

  // Payload específico do evento
  readonly documentoId: string;
  readonly clienteId: string;
  readonly contadorResponsavelId: string | null;
  readonly ipAddress: string;
  readonly nomeArquivo: string;
  readonly sector: string;
  readonly visualizadoPorId: string;
  readonly visualizadoPorRole: 'CLIENT' | 'ACCOUNTANT' | 'ADMIN';

  constructor(payload: DocumentoVisualizadoPayload) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();

    this.documentoId = payload.documentoId;
    this.clienteId = payload.clienteId;
    this.contadorResponsavelId = payload.contadorResponsavelId;
    this.ipAddress = payload.ipAddress;
    this.nomeArquivo = payload.nomeArquivo;
    this.sector = payload.sector;
    this.visualizadoPorId = payload.visualizadoPorId;
    this.visualizadoPorRole = payload.visualizadoPorRole;

    // Congela o objeto para garantir imutabilidade após construção
    Object.freeze(this);
  }

  /**
   * Gera a mensagem de notificação para exibição no WebSocket do contador.
   * Exemplo: "Empresa ABC Ltda visualizou NF_2026_03.xml (Fiscal)"
   */
  gerarMensagemNotificacao(nomeCliente: string): string {
    return `${nomeCliente} visualizou "${this.nomeArquivo}" (${this.sector})`;
  }
}
