import { NextResponse } from 'next/server';

import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma }   from '@/infrastructure/di/Container';
import { logger }   from '@/utils/logger';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Mapa de labels legíveis para ActionType
// =============================================================================

const ACTION_LABELS: Record<string, string> = {
  DOWNLOAD:           'baixou um documento',
  VIEW:               'visualizou um documento',
  UPLOAD_BATCH:       'enviou documentos em lote',
  LOGIN:              'fez login no sistema',
  LOGOUT:             'saiu do sistema',
  STATE_CHANGE:       'alterou status de tarefa',
  OFFBOARD_INITIATED: 'iniciou offboarding',
  OFFBOARD_COMPLETED: 'concluiu offboarding',
  LGPD_EXPORT:        'exportou dados (LGPD)',
  LGPD_ANONYMIZE:     'anonimizou dados (LGPD)',
};

// =============================================================================
// GET /api/v1/dashboard/activity
//
// Retorna as últimas atividades registradas no AuditLog.
// Usado pelo RecentActivityFeed no Dashboard do Contador.
//
// Query params:
//   limit → número de atividades (padrão: 15, máx: 50)
//
// Response 200:
//   { atividades: AtividadeDTO[] }
// =============================================================================

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const { searchParams } = req.nextUrl;
    const limitRaw = parseInt(searchParams.get('limit') ?? '15', 10);
    const limit = Math.min(Math.max(limitRaw, 1), 50);

    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    // Escopo: apenas usuários do escritório (contador + seus clientes + seus funcionários)
    const [vinculos, funcionariosEscopo] = await Promise.all([
      prisma.contadorCliente.findMany({
        where:  { contadorId },
        select: { clienteId: true },
      }),
      prisma.funcionario.findMany({
        where:  { contadorId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    const userIdsEscopo = [
      contadorId,
      ...vinculos.map((v) => v.clienteId),
      ...funcionariosEscopo.map((f) => f.id),
    ];

    const logs = await prisma.auditLog.findMany({
      where:   { userId: { in: userIdsEscopo } },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id:           true,
        userId:       true,
        actionType:   true,
        resourceType: true,
        detailsJson:  true,
        timestamp:    true,
      },
    });

    // Buscar nomes dos usuários (clientes + contadores + funcionários)
    const userIds = [...new Set(logs.map((l) => l.userId))];

    const [clientes, contadores, funcionarios] = await Promise.all([
      prisma.usuarioCliente.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      prisma.usuarioContador.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true },
      }),
      prisma.funcionario.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true },
      }),
    ]);

    const nomeMap = new Map<string, string>();
    for (const c of clientes)      nomeMap.set(c.id, c.name);
    for (const c of contadores)    nomeMap.set(c.id, c.name);
    for (const f of funcionarios)  nomeMap.set(f.id, f.name);

    const atividades = logs.map((log) => {
      const details = (log.detailsJson ?? {}) as Record<string, unknown>;
      return {
        id:           log.id,
        usuario:      nomeMap.get(log.userId) ?? 'Usuário',
        acao:         ACTION_LABELS[log.actionType] ?? log.actionType,
        actionType:   log.actionType,
        resourceType: log.resourceType,
        arquivo:      (details.fileName as string) ?? null,
        timestamp:    log.timestamp.toISOString(),
      };
    });

    return NextResponse.json({ atividades });
  } catch (err) {
    logger.error('[GET /dashboard/activity] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
