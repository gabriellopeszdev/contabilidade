import type { DocumentoFiscal } from '../../domain/entities/DocumentoFiscal';
import type { SetorTipo } from '../../domain/value-objects/Setor';

// =============================================================================
// DocumentoMapper — Entidade Rica → DTO de Apresentação
//
// RESPONSABILIDADE:
//   Isola a camada de apresentação da entidade de domínio. O front-end NUNCA
//   deve receber uma instância de `DocumentoFiscal` diretamente — apenas o DTO.
//
// O QUE É OMITIDO INTENCIONALMENTE:
//   - storagePath : caminho interno do MinIO (nunca exposto ao cliente)
//   - fileHash    : hash de integridade (uso interno; irrelevante para o cliente)
//   - uploadedById: quem fez o upload (dado interno do escritório)
//   - clientId    : implícito no contexto de autenticação
//   - metadataJson: metadados técnicos internos (extendíveis por setor)
//
// CONVENÇÃO DE DATAS:
//   - Timestamps (readAt, createdAt): ISO 8601 completo (ex: 2026-01-15T10:30:00Z)
//   - Datas calendário (competencia): apenas YYYY-MM-DD, sem componente de hora,
//     para evitar deslocamento de fuso horário no navegador.
// =============================================================================

/** DTO serializado que trafega entre o servidor e o front-end. */
export interface DocumentoDTO {
  id:            string;
  fileName:      string;
  fileType:      'XML' | 'PDF' | 'XLSX' | 'XLS' | 'DOCX' | 'DOC' | 'CSV' | 'OFX' | 'ODS';
  /** Tamanho em bytes (number — documentos fiscais << 2^53). */
  fileSizeBytes: number;
  sector:        SetorTipo;
  sectorDescricao: string;
  readStatus:    boolean;
  /** ISO 8601 ou null. */
  readAt:        string | null;
  /** Apenas YYYY-MM-DD ou null. */
  competencia:   string | null;
  /** ISO 8601. */
  createdAt:     string;
}

export class DocumentoMapper {
  // Classe estática — não deve ser instanciada.
  private constructor() {}

  /**
   * Converte uma entidade rica `DocumentoFiscal` em um `DocumentoDTO` plano.
   *
   * @param documento Entidade de domínio (pode ser recém-criada ou reconstituída).
   * @returns DTO serializado com apenas os dados necessários para o front-end.
   */
  static toDTO(documento: DocumentoFiscal): DocumentoDTO {
    return {
      id:            documento.id,
      fileName:      documento.fileName,
      fileType:      documento.fileType,
      // BigInt → Number: documentos fiscais tipicamente têm < 10 MB,
      // portanto o valor sempre cabe em Number.MAX_SAFE_INTEGER (2^53 - 1).
      fileSizeBytes: Number(documento.fileSizeBytes),
      sector:        documento.sector.tipo,
      sectorDescricao: documento.sector.descricao,
      readStatus:    documento.readStatus,
      readAt:        documento.readAt?.toISOString() ?? null,
      // Extrai apenas YYYY-MM-DD para evitar deslocamento de fuso horário
      // ao renderizar no navegador (Date construído de ISO string com hora T00:00
      // pode ser exibido como dia anterior dependendo do offset do cliente).
      competencia:   documento.competencia
        ? documento.competencia.toISOString().split('T')[0]
        : null,
      createdAt:     documento.createdAt.toISOString(),
    };
  }

  /**
   * Converte uma lista de entidades em DTOs.
   * Atalho para `documentos.map(DocumentoMapper.toDTO)`.
   */
  static toDTOList(documentos: DocumentoFiscal[]): DocumentoDTO[] {
    return documentos.map((d) => DocumentoMapper.toDTO(d));
  }
}
