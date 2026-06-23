import { NextRequest, NextResponse } from 'next/server';

import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../src/utils/logger';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/admin/audit-log
//
// Lista todos os logs de auditoria do sistema (acesso exclusivo ADMIN).
//
// Query params:
//   - page         (default: 1)
//   - perPage      (default: 50, max: 200)
//   - userId       (opcional) — filtra por usuário específico
//   - escritorioId (opcional) — filtra por escritório (contador + clientes + funcionários)
//   - actionType   (opcional) — filtra por tipo de ação
//   - from         (opcional) — data inicial ISO (ex: 2024-01-01)
//   - to           (opcional) — data final ISO (ex: 2024-12-31)
//
// Response: { logs, total, page, totalPages }
// =============================================================================

export const GET = withAuth(async (req: NextRequest, _ctx: RouteContext) => {
  try {
    const url      = new URL(req.url);
    const page     = Math.max(1, parseInt(url.searchParams.get('page')    ?? '1',  10));
    const perPage  = Math.min(200, Math.max(1, parseInt(url.searchParams.get('perPage') ?? '50', 10)));
    const skip     = (page - 1) * perPage;

    const userId       = url.searchParams.get('userId')       ?? undefined;
    const escritorioId = url.searchParams.get('escritorioId') ?? undefined;
    const actionType   = url.searchParams.get('actionType')   ?? undefined;
    const from         = url.searchParams.get('from')         ?? undefined;
    const to           = url.searchParams.get('to')           ?? undefined;

    // -------------------------------------------------------------------------
    // Construir filtro Prisma
    // -------------------------------------------------------------------------
    const where: Record<string, unknown> = {};

    if (userId)     where.userId     = userId;
    if (actionType) where.actionType = actionType;

    if (from || to) {
      const timestampFilter: Record<string, Date> = {};
      if (from) timestampFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        timestampFilter.lte = toDate;
      }
      where.timestamp = timestampFilter;
    }

    // Filtro por escritório: inclui o próprio contador + seus clientes + seus funcionários
    if (escritorioId && !userId) {
      const [clientLinks, employees] = await Promise.all([
        prisma.contadorCliente.findMany({
          where: { contadorId: escritorioId },
          select: { clienteId: true },
        }),
        prisma.funcionario.findMany({
          where: { contadorId: escritorioId, deletedAt: null },
          select: { id: true },
        }),
      ]);
      where.userId = {
        in: [
          escritorioId,
          ...clientLinks.map((l) => l.clienteId),
          ...employees.map((e) => e.id),
        ],
      };
    }

    // -------------------------------------------------------------------------
    // Buscar logs + total em paralelo
    // -------------------------------------------------------------------------
    const [rawLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: perPage,
        select: {
          id:           true,
          userId:       true,
          actionType:   true,
          resourceType: true,
          timestamp:    true,
          ipAddress:    true,
          detailsJson:  true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // -------------------------------------------------------------------------
    // Enriquecer com nome/email/escritório do usuário
    // -------------------------------------------------------------------------
    const uniqueUserIds = [...new Set(rawLogs.map((l) => l.userId))];

    const [contadores, clientes, clienteLinks] = await Promise.all([
      prisma.usuarioContador.findMany({
        where: { id: { in: uniqueUserIds } },
        select: {
          id:    true,
          name:  true,
          email: true,
          configuracao: { select: { nomeEscritorio: true } },
        },
      }),
      prisma.usuarioCliente.findMany({
        where: { id: { in: uniqueUserIds } },
        select: { id: true, name: true, email: true },
      }),
      // Para clientes: descobre o contador responsável (para exibir o nome do escritório)
      prisma.contadorCliente.findMany({
        where:    { clienteId: { in: uniqueUserIds } },
        select:   { clienteId: true, contadorId: true },
        distinct: ['clienteId'],
      }),
    ]);

    // Busca o nomeEscritório dos contadors vinculados a clientes (que não estão nos logs diretos)
    const linkedContadorIds = [...new Set(clienteLinks.map((l) => l.contadorId))].filter(
      (id) => !contadores.find((c) => c.id === id),
    );

    const linkedConfigs = linkedContadorIds.length > 0
      ? await prisma.configuracaoEscritorio.findMany({
          where:  { contadorId: { in: linkedContadorIds } },
          select: { contadorId: true, nomeEscritorio: true },
        })
      : [];

    const linkedConfigMap = new Map<string, string>();
    for (const c of linkedConfigs) linkedConfigMap.set(c.contadorId, c.nomeEscritorio);

    // clienteId → nomeEscritorio
    const clienteEscritorioMap = new Map<string, string>();
    for (const link of clienteLinks) {
      // Primeiro tenta nos configs buscados acima, depois nos próprios contadores dos logs
      const nome =
        linkedConfigMap.get(link.contadorId) ??
        contadores.find((c) => c.id === link.contadorId)?.configuracao?.nomeEscritorio ??
        undefined;
      if (nome) clienteEscritorioMap.set(link.clienteId, nome);
    }

    // Mapa userId → { name, email, escritorioNome }
    const userMap = new Map<string, { name: string; email: string; escritorioNome: string | null }>();
    for (const c of contadores) {
      userMap.set(c.id, {
        name:          c.name,
        email:         c.email,
        escritorioNome: c.configuracao?.nomeEscritorio ?? null,
      });
    }
    for (const c of clientes) {
      userMap.set(c.id, {
        name:          c.name,
        email:         c.email,
        escritorioNome: clienteEscritorioMap.get(c.id) ?? null,
      });
    }

    const logs = rawLogs.map((log) => {
      const user = userMap.get(log.userId) ?? { name: 'Desconhecido', email: '-', escritorioNome: null };
      return {
        id:            log.id,
        userId:        log.userId,
        userName:      user.name,
        userEmail:     user.email,
        escritorioNome: user.escritorioNome,
        actionType:    log.actionType,
        resourceType:  log.resourceType,
        timestamp:     log.timestamp,
        ipAddress:     log.ipAddress,
        detailsJson:   log.detailsJson,
      };
    });

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    logger.error('[GET /admin/audit-log] Erro interno', err instanceof Error ? err : { err });
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ADMIN']);
