import { NextResponse } from 'next/server';

import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/dashboard/charts
//
// Retorna dados agregados para os gráficos de BI do Dashboard:
//
//   tarefasPorStatus → distribuição de tarefas por estado (PENDING, PROCESSING, REVIEW, DONE)
//   tarefasPorSetor  → distribuição de tarefas por setor (FISCAL, PESSOAL, CONTABIL)
//   documentosPorMes → volume de documentos dos últimos 6 meses
//
// Todas as queries usam groupBy com _count (sem carregar registros).
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    // Clientes do contador — escopo para todas as queries
    const vinculos = await prisma.contadorCliente.findMany({
      where:  { contadorId },
      select: { clienteId: true },
    });
    const meusClienteIds = vinculos.map((v) => v.clienteId);

    const [statusAgg, setorAgg, volumeMensal, eficienciaMensal] = await Promise.all([
      // 1. Tarefas agrupadas por status — apenas clientes deste contador
      prisma.tarefaKanban.groupBy({
        by:    ['currentState'],
        _count: { id: true },
        where: { clientId: { in: meusClienteIds } },
      }),

      // 2. Tarefas agrupadas por setor — apenas clientes deste contador
      prisma.tarefaKanban.groupBy({
        by:    ['sector'],
        _count: { id: true },
        where: { sector: { not: null }, clientId: { in: meusClienteIds } },
      }),

      // 3. Volume de documentos dos últimos 6 meses — apenas clientes deste contador
      prisma.$queryRaw<Array<{ mes: string; total: bigint }>>`
        SELECT
          TO_CHAR(df.created_at, 'YYYY-MM') AS mes,
          COUNT(*)::bigint AS total
        FROM documento_fiscal df
        INNER JOIN contador_cliente cc ON cc.cliente_id = df.client_id
        WHERE df.deleted_at IS NULL
          AND df.created_at >= NOW() - INTERVAL '6 months'
          AND cc.contador_id = ${contadorId}::uuid
        GROUP BY TO_CHAR(df.created_at, 'YYYY-MM')
        ORDER BY mes ASC
      `,

      // 4. Eficiência: tarefas concluídas vs criadas por mês — apenas clientes deste contador
      prisma.$queryRaw<Array<{ mes: string; criadas: bigint; concluidas: bigint }>>`
        SELECT
          TO_CHAR(tk.created_at, 'YYYY-MM') AS mes,
          COUNT(*)::bigint AS criadas,
          COUNT(*) FILTER (WHERE tk.current_state = 'DONE')::bigint AS concluidas
        FROM tarefa_kanban tk
        INNER JOIN contador_cliente cc ON cc.cliente_id = tk.client_id
        WHERE tk.created_at >= NOW() - INTERVAL '6 months'
          AND cc.contador_id = ${contadorId}::uuid
        GROUP BY TO_CHAR(tk.created_at, 'YYYY-MM')
        ORDER BY mes ASC
      `,
    ]);

    // Mapear status para labels legíveis
    const STATUS_LABELS: Record<string, string> = {
      PENDING:    'Pendente',
      PROCESSING: 'Em Execução',
      REVIEW:     'Em Revisão',
      DONE:       'Concluído',
    };

    const STATUS_CORES: Record<string, string> = {
      PENDING:    '#9ca3af',
      PROCESSING: '#3b82f6',
      REVIEW:     '#f59e0b',
      DONE:       '#10b981',
    };

    const tarefasPorStatus = statusAgg.map((g) => ({
      nome:  STATUS_LABELS[g.currentState] ?? g.currentState,
      valor: g._count.id,
      cor:   STATUS_CORES[g.currentState] ?? '#6b7280',
    }));

    const SETOR_LABELS: Record<string, string> = {
      FISCAL:   'Fiscal',
      PESSOAL:  'Pessoal',
      CONTABIL: 'Contábil',
    };

    const SETOR_CORES: Record<string, string> = {
      FISCAL:   '#6366f1',
      PESSOAL:  '#ec4899',
      CONTABIL: '#14b8a6',
    };

    const tarefasPorSetor = setorAgg.map((g) => ({
      nome:  SETOR_LABELS[g.sector ?? ''] ?? (g.sector ?? 'Sem setor'),
      valor: g._count.id,
      cor:   SETOR_CORES[g.sector ?? ''] ?? '#6b7280',
    }));

    // Preencher meses faltantes com zero (últimos 6 meses)
    const mesesMap = new Map(
      volumeMensal.map((r) => [r.mes, Number(r.total)]),
    );

    const documentosPorMes: Array<{ mes: string; label: string; total: number }> = [];
    const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      documentosPorMes.push({
        mes:   key,
        label: `${MESES_PT[d.getMonth()]}/${d.getFullYear()}`,
        total: mesesMap.get(key) ?? 0,
      });
    }

    // Eficiência mensal
    const eficienciaMap = new Map(
      eficienciaMensal.map((r) => [r.mes, { criadas: Number(r.criadas), concluidas: Number(r.concluidas) }]),
    );

    const eficienciaPorMes: Array<{ mes: string; label: string; criadas: number; concluidas: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const eff = eficienciaMap.get(key) ?? { criadas: 0, concluidas: 0 };
      eficienciaPorMes.push({
        mes: key,
        label: `${MESES_PT[d.getMonth()]}/${d.getFullYear()}`,
        criadas: eff.criadas,
        concluidas: eff.concluidas,
      });
    }

    return NextResponse.json({
      tarefasPorStatus,
      tarefasPorSetor,
      documentosPorMes,
      eficienciaPorMes,
    });
  } catch (err) {
    logger.error('[GET /dashboard/charts] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
