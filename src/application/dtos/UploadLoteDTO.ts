import type { SetorTipo } from '../../domain/value-objects/Setor';

// ---------------------------------------------------------------------------
// Input DTO: dados de um único arquivo no lote
// ---------------------------------------------------------------------------

/**
 * Representa um único arquivo dentro do lote de upload.
 *
 * O `conteudo` (Buffer) é recebido pelo controller a partir do FormData
 * e passado ao use case. Para o fluxo de Presigned URLs (upload direto ao MinIO),
 * usar `ProcessarConfirmacaoUploadLoteDTO` (futuro use case).
 */
export interface ArquivoUploadInputDTO {
  /** Nome original do arquivo (ex: "NF_2026_03.xml"). */
  readonly fileName: string;
  /** MIME type do arquivo: 'application/xml', 'text/xml', 'application/pdf'. */
  readonly mimeType: string;
  /** Tamanho em bytes (validado contra limite de 10MB). */
  readonly fileSizeBytes: number;
  /** Conteúdo binário do arquivo. Máx 10MB por arquivo. */
  readonly conteudo: Buffer;
  /**
   * Mês de competência fiscal (ex: 2026-03-01 para março/2026).
   * Opcional — se nulo, usa o mês atual no path do MinIO.
   */
  readonly competencia?: Date;
  /** Metadados extras extraídos pelo front-end (ex: valor NF do XML). */
  readonly metadataExtra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Input DTO: parâmetros globais do lote
// ---------------------------------------------------------------------------

export interface ProcessarUploadLoteInputDTO {
  /** ID do cliente dono dos documentos. */
  readonly clienteId: string;
  /** ID do contador que está realizando o upload. */
  readonly contadorId: string;
  /** Setor de classificação de todos os arquivos do lote. */
  readonly sector: SetorTipo;
  /** Arquivos do lote. Mínimo 1, máximo 50. */
  readonly arquivos: ArquivoUploadInputDTO[];
  /**
   * ID opcional do lote (UUID). Se não fornecido, o use case gera automaticamente.
   * Útil para idempotência em caso de retry do cliente.
   */
  readonly loteId?: string;
  /** IP do contador (para audit log). */
  readonly ipAddress: string;
  /** User-Agent do browser (para audit log). */
  readonly userAgent?: string;
}

// ---------------------------------------------------------------------------
// Output DTOs: resultado por arquivo e do lote completo
// ---------------------------------------------------------------------------

export interface ArquivoUploadResultadoDTO {
  /** ID do DocumentoFiscal persistido no banco. */
  readonly documentoId: string;
  /** Nome original do arquivo. */
  readonly fileName: string;
  /** SHA-256 calculado pelo servidor (para verificação pelo cliente). */
  readonly fileHash: string;
  /** Caminho no bucket MinIO. */
  readonly storagePath: string;
}

export interface ArquivoUploadFalhaDTO {
  /** Nome do arquivo que falhou. */
  readonly fileName: string;
  /** Motivo legível da falha. */
  readonly motivo: string;
}

export interface ProcessarUploadLoteOutputDTO {
  /** ID do lote (gerado ou passado no input). */
  readonly loteId: string;
  /** Total de arquivos recebidos (uploadados + falhas). */
  readonly totalArquivos: number;
  /** Documentos que foram processados e persistidos com sucesso. */
  readonly uploadados: ArquivoUploadResultadoDTO[];
  /** Arquivos que falharam (tipo inválido, tamanho, duplicata, etc.). */
  readonly falhas: ArquivoUploadFalhaDTO[];
}
