import type { AuditLog, ActionType, ResourceType } from '../entities/AuditLog';
import type { PaginacaoParams, ResultadoPaginado } from '../../shared/PaginationHelper';

// ---------------------------------------------------------------------------
// Tipos de filtro
// ---------------------------------------------------------------------------

export interface FiltroAuditLog {
  userId?: string;
  documentId?: string;
  actionType?: ActionType;
  resourceType?: ResourceType;
  /** Início do intervalo de tempo (inclusivo). */
  timestampInicio?: Date;
  /** Fim do intervalo de tempo (inclusivo). */
  timestampFim?: Date;
  ipAddress?: string;
}

// ---------------------------------------------------------------------------
// Contrato: IAuditLogRepository
// ---------------------------------------------------------------------------

/**
 * Port (interface) para persistência de registros de auditoria.
 *
 * REGRAS ABSOLUTAS (não negociáveis, documentadas nos ADRs):
 *   - NUNCA implementar UPDATE ou DELETE neste repositório.
 *   - A tabela `audit_logs` é append-only por design de negócio e legal.
 *   - Registros de auditoria são evidência jurídica — imutabilidade é obrigatória.
 *   - Particionamento por mês (RANGE em `timestamp`) gerenciado pelo banco.
 *
 * DESIGN:
 *   - `salvar()` e `salvarLote()` são as únicas operações de escrita.
 *   - `listar()` usa índice BRIN em `timestamp` (ideal para dados time-series).
 *   - ADMINs podem listar os logs via endpoint `/admin/audit` (RBAC no middleware).
 */
export interface IAuditLogRepository {
  /**
   * Persiste um único registro de auditoria.
   * Fire-and-forget na prática: falha de persistência do log NÃO deve
   * reverter a operação principal que o gerou.
   */
  salvar(log: AuditLog): Promise<void>;

  /**
   * Persiste múltiplos registros em uma operação batch.
   * Usado no offboarding e em eventos que geram múltiplos logs.
   */
  salvarLote(logs: AuditLog[]): Promise<void>;

  /**
   * Lista registros de auditoria com filtros e paginação.
   * Resultado ordenado por `timestamp DESC` (mais recente primeiro).
   * Acesso restrito a ADMINs (verificado no RBAC middleware).
   */
  listar(
    filtros?: FiltroAuditLog,
    paginacao?: PaginacaoParams,
  ): Promise<ResultadoPaginado<AuditLog>>;

  /**
   * Lista todos os logs de auditoria de um cliente específico.
   * Usado no processo de offboarding para gerar o relatório de ações.
   * Retorna lista completa (sem paginação) para geração do .zip.
   */
  listarPorClienteParaOffboarding(clienteId: string): Promise<AuditLog[]>;
}
