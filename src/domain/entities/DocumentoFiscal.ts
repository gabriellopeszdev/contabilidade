import { createHash } from 'node:crypto';
import { AggregateRoot } from '../../shared/AggregateRoot';
import type { DomainEvent } from '../../shared/DomainEvent';
import { DomainException } from '../exceptions/DomainException';
import { Setor } from '../value-objects/Setor';

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

export type FileType = 'XML' | 'PDF' | 'XLSX' | 'XLS' | 'DOCX' | 'DOC' | 'CSV' | 'OFX' | 'ODS' | 'ZIP' | 'RAR';

export interface DocumentoFiscalProps {
  id: string;
  clientId: string;
  uploadedById: string;
  sector: Setor;
  fileName: string;
  storagePath: string;
  fileType: FileType;
  fileSizeBytes: number;
  fileHash: string;
  readStatus: boolean;
  readAt: Date | null;
  competencia: Date | null;
  metadataJson: Record<string, unknown>;
  createdAt: Date;
  categoria?: string | null;
}

// ---------------------------------------------------------------------------
// Eventos de domínio (placeholders — implementados em src/domain/events/)
// ---------------------------------------------------------------------------

interface DocumentoVisualizadoPayload extends DomainEvent {
  documentoId: string;
  clienteId: string;
}

// ---------------------------------------------------------------------------
// Entidade Rica: DocumentoFiscal
// ---------------------------------------------------------------------------

/**
 * Entidade Rica: DocumentoFiscal
 *
 * Representa um arquivo XML ou PDF fiscal armazenado no sistema.
 * O arquivo físico reside no MinIO; esta entidade carrega apenas os metadados.
 *
 * ESTADO MUTÁVEL: readStatus, readAt (rastreamento de leitura pelo cliente).
 * ESTADO IMUTÁVEL: todos os demais campos (definidos na criação/upload).
 *
 * Métodos públicos de negócio:
 *   - registrarVisualizacao(): marca como lido na primeira abertura
 *   - marcarComoLido(): força marcação de leitura
 *   - validarIntegridade(conteudo): compara SHA-256 do conteúdo com hash armazenado
 *   - gerarHash(conteudo): static — calcula SHA-256 de um buffer (usado no upload)
 */
export class DocumentoFiscal extends AggregateRoot {
  private _readStatus: boolean;
  private _readAt: Date | null;

  private constructor(private readonly _props: DocumentoFiscalProps) {
    super();
    this._readStatus = _props.readStatus;
    this._readAt = _props.readAt;
    DocumentoFiscal.validarProps(_props);
  }

  // ---------------------------------------------------------------------------
  // Validação interna de invariantes
  // ---------------------------------------------------------------------------

  private static validarProps(props: DocumentoFiscalProps): void {
    if (!props.id?.trim()) {
      throw new DomainException('DocumentoFiscal: ID é obrigatório.');
    }
    if (!props.clientId?.trim()) {
      throw new DomainException('DocumentoFiscal: clientId é obrigatório.');
    }
    if (!props.uploadedById?.trim()) {
      throw new DomainException('DocumentoFiscal: uploadedById é obrigatório.');
    }
    if (!props.fileName?.trim()) {
      throw new DomainException('DocumentoFiscal: nome do arquivo é obrigatório.');
    }
    if (!props.storagePath?.trim()) {
      throw new DomainException('DocumentoFiscal: storagePath é obrigatório.');
    }
    if (props.fileSizeBytes <= 0) {
      throw new DomainException('DocumentoFiscal: tamanho do arquivo deve ser positivo.');
    }
    if (!props.fileHash?.trim()) {
      throw new DomainException('DocumentoFiscal: hash do arquivo é obrigatório.');
    }
    const TIPOS_VALIDOS: FileType[] = ['XML', 'PDF', 'XLSX', 'XLS', 'DOCX', 'DOC', 'CSV', 'OFX', 'ODS', 'ZIP', 'RAR'];
    if (!TIPOS_VALIDOS.includes(props.fileType)) {
      throw new DomainException(
        `DocumentoFiscal: tipo de arquivo inválido "${props.fileType}". Aceitos: XML, PDF, XLSX, XLS, DOCX, DOC, CSV, OFX, ODS, ZIP, RAR.`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  /**
   * Cria um novo DocumentoFiscal após upload.
   * readStatus = false por padrão (cliente ainda não visualizou).
   */
  static criar(
    props: Omit<DocumentoFiscalProps, 'readStatus' | 'readAt' | 'createdAt'>,
  ): DocumentoFiscal {
    return new DocumentoFiscal({
      ...props,
      readStatus: false,
      readAt: null,
      createdAt: new Date(),
    });
  }

  /**
   * Reconstitui a entidade a partir dos dados do banco de dados.
   * Não emite eventos — é apenas uma reconstituição de estado.
   */
  static reconstituir(props: DocumentoFiscalProps): DocumentoFiscal {
    return new DocumentoFiscal(props);
  }

  // ---------------------------------------------------------------------------
  // Métodos de negócio (comportamento da entidade — não anêmica)
  // ---------------------------------------------------------------------------

  /**
   * Registra que o cliente visualizou/abriu o documento.
   * Idempotente: se já foi lido, não altera o estado nem emite evento duplicado.
   * Emite `DocumentoVisualizadoEvent` na primeira visualização.
   */
  registrarVisualizacao(): void {
    if (!this._readStatus) {
      this.marcarComoLido();

      // Evento emitido apenas na primeira visualização (não duplica)
      const evento: DocumentoVisualizadoPayload = {
        eventId: crypto.randomUUID(),
        eventName: 'DocumentoVisualizadoEvent',
        occurredAt: new Date(),
        documentoId: this._props.id,
        clienteId: this._props.clientId,
      };
      this.addDomainEvent(evento);
    }
  }

  /**
   * Força a marcação do documento como lido.
   * Use `registrarVisualizacao()` no fluxo normal — este método é público
   * para casos administrativos (ex: migração de dados).
   */
  marcarComoLido(): void {
    this._readStatus = true;
    this._readAt = new Date();
  }

  /**
   * Valida a integridade do arquivo comparando o conteúdo atual com o hash armazenado.
   * Retorna `true` se o conteúdo não foi corrompido ou alterado.
   * Chamado no download para garantir que o arquivo do MinIO está íntegro.
   *
   * @param conteudo Buffer com o conteúdo binário do arquivo baixado do MinIO.
   */
  validarIntegridade(conteudo: Buffer): boolean {
    const hashCalculado = DocumentoFiscal.gerarHash(conteudo);
    return hashCalculado === this._props.fileHash;
  }

  /**
   * Gera o hash SHA-256 do conteúdo de um arquivo.
   * Método estático — usado no upload antes de persistir a entidade.
   * O resultado deve ser passado como `fileHash` no factory `criar()`.
   *
   * @param conteudo Buffer com o conteúdo binário do arquivo.
   * @returns String hexadecimal de 64 caracteres (SHA-256).
   */
  static gerarHash(conteudo: Buffer): string {
    return createHash('sha256').update(conteudo).digest('hex');
  }

  // ---------------------------------------------------------------------------
  // Getters (somente leitura — imutabilidade do estado externo)
  // ---------------------------------------------------------------------------

  get id(): string { return this._props.id; }
  get clientId(): string { return this._props.clientId; }
  get uploadedById(): string { return this._props.uploadedById; }
  get sector(): Setor { return this._props.sector; }
  get fileName(): string { return this._props.fileName; }
  get storagePath(): string { return this._props.storagePath; }
  get fileType(): FileType { return this._props.fileType; }
  get fileSizeBytes(): number { return this._props.fileSizeBytes; }
  get fileHash(): string { return this._props.fileHash; }
  get readStatus(): boolean { return this._readStatus; }
  get readAt(): Date | null { return this._readAt; }
  get competencia(): Date | null { return this._props.competencia; }
  get metadataJson(): Readonly<Record<string, unknown>> { return this._props.metadataJson; }
  get createdAt(): Date { return this._props.createdAt; }
  get categoria(): string | null { return this._props.categoria; }
}
