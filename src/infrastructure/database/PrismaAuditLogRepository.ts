import type { PrismaClient, Prisma } from '@prisma/client';
import type { AuditLog as PrismaAuditLogRow } from '@prisma/client';

import {
  AuditLog,
  type ActionType,
  type ResourceType,
} from '../../domain/entities/AuditLog';
import type {
  IAuditLogRepository,
  FiltroAuditLog,
} from '../../domain/ports/IAuditLogRepository';
import type { PaginacaoParams, ResultadoPaginado } from '../../shared/PaginationHelper';
import { PaginacaoHelper } from '../../shared/PaginationHelper';

// =============================================================================
// PrismaAuditLogRepository
//
// Implementação append-only de IAuditLogRepository.
//
// REGRA ABSOLUTA: este repositório NÃO implementa UPDATE nem DELETE.
// Registros de auditoria são evidência jurídica — imutabilidade é mandatória.
// Qualquer tentativa de modificar ou excluir um AuditLog deve ser rejeitada
// a nível de banco de dados (sem permissão DELETE/UPDATE na role da aplicação).
// =============================================================================

export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ---------------------------------------------------------------------------
  // salvar — append-only insert
  // ---------------------------------------------------------------------------

  async salvar(log: AuditLog): Promise<void> {
    await this.prisma.auditLog.create({
      data: PrismaAuditLogRepository.toCreateInput(log),
    });
  }

  // ---------------------------------------------------------------------------
  // salvarLote — batch insert (offboarding, eventos que geram múltiplos logs)
  // ---------------------------------------------------------------------------

  async salvarLote(logs: AuditLog[]): Promise<void> {
    if (logs.length === 0) return;
    await this.prisma.auditLog.createMany({
      data: logs.map(PrismaAuditLogRepository.toCreateInput),
    });
  }

  // ---------------------------------------------------------------------------
  // listar — paginado, filtrado, ordenado por timestamp DESC
  // ---------------------------------------------------------------------------

  async listar(
    filtros?: FiltroAuditLog,
    paginacao?: PaginacaoParams,
  ): Promise<ResultadoPaginado<AuditLog>> {
    const params = paginacao ?? PaginacaoHelper.padrao();
    PaginacaoHelper.validar(params);

    const where = PrismaAuditLogRepository.buildWhereClause(filtros);
    const skip  = PaginacaoHelper.calcularOffset(params);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: params.perPage,
      }),
    ]);

    return PaginacaoHelper.construir(
      rows.map(PrismaAuditLogRepository.toDomain),
      total,
      params,
    );
  }

  // ---------------------------------------------------------------------------
  // listarPorClienteParaOffboarding — lista completa (sem paginação)
  // Retorna todos os logs onde o userId = clienteId (ações do cliente)
  // O use case de offboarding usa este método para gerar o relatório LGPD
  // ---------------------------------------------------------------------------

  async listarPorClienteParaOffboarding(clienteId: string): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      where:   { userId: clienteId },
      orderBy: { timestamp: 'asc' },
    });
    return rows.map(PrismaAuditLogRepository.toDomain);
  }

  // ===========================================================================
  // DATA MAPPER — métodos privados estáticos
  // ===========================================================================

  /**
   * Prisma Row → AuditLog (Entidade Imutável do Domínio)
   *
   * Pontos do mapeamento:
   *   - actionType/resourceType: enums do Prisma são strings compatíveis com
   *     os union types do domínio — cast explícito com `as ActionType`
   *   - detailsJson: Prisma.JsonValue → Record<string, unknown> (cast seguro —
   *     só gravamos objetos neste campo, nunca arrays ou primitivos)
   *   - ipAddress: @db.Inet retorna como string no Prisma — já é o tipo esperado
   */
  private static toDomain(row: PrismaAuditLogRow): AuditLog {
    return AuditLog.reconstituir({
      id:           row.id,
      documentId:   row.documentId,
      userId:       row.userId,
      actionType:   row.actionType as ActionType,
      resourceType: row.resourceType as ResourceType,
      detailsJson:  (row.detailsJson ?? {}) as Record<string, unknown>,
      ipAddress:    row.ipAddress,
      userAgent:    row.userAgent,
      timestamp:    row.timestamp,
    });
  }

  /**
   * AuditLog (Entidade Imutável) → Prisma.AuditLogCreateInput
   *
   * Não inclui campos gerenciados pelo Prisma:
   *   - updatedAt: não existe em AuditLog (append-only, sem @updatedAt)
   *   - deletedAt: não existe em AuditLog (imutável por design)
   */
  private static toCreateInput(
    log: AuditLog,
  ): Prisma.AuditLogCreateInput {
    return {
      id:           log.id,
      documentId:   log.documentId,
      userId:       log.userId,
      actionType:   log.actionType,
      resourceType: log.resourceType,
      detailsJson:  log.detailsJson as Prisma.InputJsonValue,
      ipAddress:    log.ipAddress,
      userAgent:    log.userAgent,
      timestamp:    log.timestamp,
    };
  }

  private static buildWhereClause(
    filtros?: FiltroAuditLog,
  ): Prisma.AuditLogWhereInput {
    if (!filtros) return {};

    const where: Prisma.AuditLogWhereInput = {};

    if (filtros.userId)       where.userId       = filtros.userId;
    if (filtros.documentId)   where.documentId   = filtros.documentId;
    if (filtros.actionType)   where.actionType   = filtros.actionType;
    if (filtros.resourceType) where.resourceType = filtros.resourceType;
    if (filtros.ipAddress)    where.ipAddress    = filtros.ipAddress;

    if (filtros.timestampInicio || filtros.timestampFim) {
      where.timestamp = {
        ...(filtros.timestampInicio && { gte: filtros.timestampInicio }),
        ...(filtros.timestampFim    && { lte: filtros.timestampFim }),
      };
    }

    return where;
  }
}
