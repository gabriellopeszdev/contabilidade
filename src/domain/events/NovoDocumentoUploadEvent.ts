import type { DomainEvent } from '../../shared/DomainEvent';

// ---------------------------------------------------------------------------
// Sub-tipos do payload
// ---------------------------------------------------------------------------

export interface ArquivoUploadInfo {
  /** ID gerado para o DocumentoFiscal persistido. */
  readonly documentoId: string;
  /** Nome original do arquivo enviado. */
  readonly fileName: string;
  /** Caminho no MinIO bucket. */
  readonly storagePath: string;
  /** SHA-256 do arquivo (para verificação posterior). */
  readonly fileHash: string;
}

export interface FalhaUploadInfo {
  /** Nome do arquivo que falhou. */
  readonly fileName: string;
  /** Motivo da falha (tipo inválido, duplicata, tamanho excedido, etc.). */
  readonly motivo: string;
}

export interface NovoDocumentoUploadPayload {
  /** ID único do lote de upload (gerado no use case). */
  readonly loteId: string;
  /** ID do cliente dono dos documentos. */
  readonly clienteId: string;
  /** ID do contador que realizou o upload. */
  readonly contadorId: string;
  /** Setor ao qual os documentos foram classificados. */
  readonly sector: string;
  /** Documentos que foram carregados com sucesso. */
  readonly uploadados: ArquivoUploadInfo[];
  /** Arquivos que falharam durante o processamento. */
  readonly falhas: FalhaUploadInfo[];
}

// ---------------------------------------------------------------------------
// Evento de Domínio: NovoDocumentoUploadEvent
// ---------------------------------------------------------------------------

/**
 * Evento de Domínio: NovoDocumentoUploadEvent
 *
 * Disparado ao final do `ProcessarUploadLoteUseCase`, independentemente
 * de ter havido falhas parciais. Representa a conclusão do lote.
 *
 * LISTENERS QUE CONSOMEM ESTE EVENTO:
 *   - WebSocket Handler: notifica o contador sobre o resultado do upload.
 *   - AuditLog Handler: persiste registro de UPLOAD_BATCH em audit_logs.
 *   - Notification Handler: cria entrada na tabela `notifications` para
 *     entrega no próximo login se o destinatário estiver offline.
 *
 * DESIGN:
 *   - Disparado mesmo com falhas parciais (upload parcialmente bem-sucedido).
 *   - Use `totalFalhas` e `totalUploadados` para decidir o nível de alerta
 *     na notificação do front-end.
 */
export class NovoDocumentoUploadEvent implements DomainEvent {
  readonly eventId: string;
  readonly eventName = 'NovoDocumentoUploadEvent' as const;
  readonly occurredAt: Date;

  // Payload específico do evento
  readonly loteId: string;
  readonly clienteId: string;
  readonly contadorId: string;
  readonly sector: string;
  readonly uploadados: ReadonlyArray<ArquivoUploadInfo>;
  readonly falhas: ReadonlyArray<FalhaUploadInfo>;

  constructor(payload: NovoDocumentoUploadPayload) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();

    this.loteId = payload.loteId;
    this.clienteId = payload.clienteId;
    this.contadorId = payload.contadorId;
    this.sector = payload.sector;
    this.uploadados = Object.freeze([...payload.uploadados]);
    this.falhas = Object.freeze([...payload.falhas]);

    Object.freeze(this);
  }

  // ---------------------------------------------------------------------------
  // Computed properties (derivadas do payload — não armazenadas)
  // ---------------------------------------------------------------------------

  get totalArquivos(): number {
    return this.uploadados.length + this.falhas.length;
  }

  get totalUploadados(): number {
    return this.uploadados.length;
  }

  get totalFalhas(): number {
    return this.falhas.length;
  }

  /** `true` se todos os arquivos foram uploadados com sucesso. */
  get sucesso(): boolean {
    return this.falhas.length === 0 && this.uploadados.length > 0;
  }

  /** `true` se houve falhas parciais (alguns falharam, outros não). */
  get sucessoParcial(): boolean {
    return this.falhas.length > 0 && this.uploadados.length > 0;
  }

  /**
   * Gera a mensagem de notificação para exibição no WebSocket.
   * Exemplos:
   *   - "Upload concluído: 10 documentos fiscais enviados com sucesso."
   *   - "Upload parcial: 8 de 10 documentos enviados. 2 falharam."
   *   - "Upload falhou: nenhum documento foi salvo."
   */
  gerarMensagemNotificacao(): string {
    const total = this.totalArquivos;
    const ok = this.totalUploadados;
    const erros = this.totalFalhas;
    const setor = this.sector;

    if (this.sucesso) {
      return `Upload concluído: ${ok} documento${ok > 1 ? 's' : ''} ${setor.toLowerCase()} enviado${ok > 1 ? 's' : ''} com sucesso.`;
    }
    if (this.sucessoParcial) {
      return `Upload parcial: ${ok} de ${total} documentos enviados. ${erros} falha${erros > 1 ? 's' : ''}.`;
    }
    return `Upload falhou: nenhum documento foi salvo. ${erros} erro${erros > 1 ? 's' : ''}.`;
  }
}
