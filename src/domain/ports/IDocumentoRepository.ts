import type { DocumentoFiscal, FileType } from '../entities/DocumentoFiscal';
import type { SetorTipo } from '../value-objects/Setor';
import type { PaginacaoParams, ResultadoPaginado } from '../../shared/PaginationHelper';

// ---------------------------------------------------------------------------
// Tipos de filtro e paginação específicos de DocumentoFiscal
// ---------------------------------------------------------------------------

export interface FiltroDocumento {
  /** Filtra por setor fiscal. */
  sector?: SetorTipo;
  /** Filtra por múltiplos setores (OR). Sobrescreve sector se ambos presentes. */
  setores?: SetorTipo[];
  /** Filtra por tipo de arquivo. */
  fileType?: FileType;
  /** Filtra por status de leitura (true = lido, false = não lido). */
  readStatus?: boolean;
  /** Início do intervalo de competência fiscal (inclusivo). */
  competenciaInicio?: Date;
  /** Fim do intervalo de competência fiscal (inclusivo). */
  competenciaFim?: Date;
  /** Busca por nome de arquivo (full-text search parcial). */
  termo?: string;
  /** Filtra por quem fez o upload. */
  uploadedById?: string;
  /** Filtra por lista de IDs de quem fez o upload. */
  uploadedByIds?: string[];
  /** Exclui IDs específicos da listagem. */
  uploadedByNotIds?: string[];
  /** Filtra pela categoria de upload (xml, extratos, despesas, impostos, folha, diversos). */
  categoria?: string;
}

// ---------------------------------------------------------------------------
// Contrato: IDocumentoRepository
// ---------------------------------------------------------------------------

/**
 * Port (interface) para persistência de DocumentoFiscal.
 *
 * Define o CONTRATO que o PostgresDocumentoRepository (infraestrutura) deve implementar.
 * A camada de domínio e de aplicação NUNCA importam implementações concretas —
 * apenas este contrato. Inversão de Dependência (DIP - SOLID).
 *
 * DESIGN:
 *   - Soft delete: `deletar()` marca `deleted_at`, nunca remove fisicamente.
 *   - `salvarLote()` deve ser executado em transação única (atomicidade).
 *   - `hashJaExiste()` é otimizado para índice parcial em `file_hash`.
 */
export interface IDocumentoRepository {
  /**
   * Persiste um único DocumentoFiscal.
   * Lança erro se já existir um documento com o mesmo `id`.
   */
  salvar(documento: DocumentoFiscal): Promise<void>;

  /**
   * Persiste uma lista de DocumentoFiscal em transação única.
   * Se qualquer item falhar, toda a operação é revertida (rollback).
   * Máximo de 50 documentos por chamada (limite do lote de upload).
   */
  salvarLote(documentos: DocumentoFiscal[]): Promise<void>;

  /**
   * Busca um DocumentoFiscal pelo ID.
   * Retorna `null` se não encontrado ou se soft-deleted.
   */
  buscarPorId(id: string): Promise<DocumentoFiscal | null>;

  /**
   * Lista os documentos de um cliente com filtros e paginação.
   * Aplica automaticamente `WHERE deleted_at IS NULL`.
   */
  listarPorCliente(
    clienteId: string,
    filtros?: FiltroDocumento,
    paginacao?: PaginacaoParams,
  ): Promise<ResultadoPaginado<DocumentoFiscal>>;

  /**
   * Verifica se um arquivo com o mesmo hash e cliente já foi enviado.
   * Usado para deduplicação no upload. Otimizado via índice `idx_docs_file_hash`.
   *
   * @returns `true` se o arquivo já existe (duplicata), `false` caso contrário.
   */
  hashJaExiste(fileHash: string, clienteId: string): Promise<boolean>;

  /**
   * Persiste as alterações de estado de um DocumentoFiscal existente.
   * Usado principalmente para atualizar `read_status` e `read_at`.
   */
  atualizar(documento: DocumentoFiscal): Promise<void>;

  /**
   * Soft delete: define `deleted_at = NOW()`.
   * Apenas ADMINs podem deletar documentos (verificação feita no RBAC middleware).
   */
  deletar(id: string): Promise<void>;

  /**
   * Lista documentos para o processo de offboarding (inclui soft-deleted).
   * Retorna TODOS os documentos do cliente, independente de `deleted_at`.
   * Uso exclusivo do EncerrarContratoClienteUseCase.
   */
  listarTodosDoClienteParaOffboarding(clienteId: string): Promise<DocumentoFiscal[]>;
}
