import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/dashboard/cliente/charts
//
// Retorna dados analíticos para o dashboard do cliente:
//   - documentosPorMes: volume mensal de documentos recebidos (últimos 6 meses)
//   - documentosPorSetor: distribuição por setor (SetorTipo)
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const [volumeMensal, setorAgg] = await Promise.all([
      // Documentos por mês (últimos 6 meses) do cliente
      prisma.$queryRaw<Array<{ mes: string; total: bigint }>>`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') AS mes,
          COUNT(*)::bigint AS total
        FROM documento_fiscal
        WHERE deleted_at IS NULL
          AND client_id = ${auth.sub}
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY mes ASC
      `,

      // Documentos por setor
      prisma.documentoFiscal.groupBy({
        by: ['sector'],
        _count: { id: true },
        where: { clientId: auth.sub, deletedAt: null },
      }),
    ]);

    // Preencher meses vazios
    const mesesMap = new Map(volumeMensal.map((r) => [r.mes, Number(r.total)]));
    const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const documentosPorMes: Array<{ mes: string; label: string; total: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      documentosPorMes.push({
        mes: key,
        label: `${MESES_PT[d.getMonth()]}/${d.getFullYear()}`,
        total: mesesMap.get(key) ?? 0,
      });
    }

    const SETOR_LABELS: Record<string, string> = {
      FISCAL: 'Fiscal',
      PESSOAL: 'Pessoal',
      CONTABIL: 'Contábil',
      TRIBUTARIO: 'Tributário',
      SOCIETARIO: 'Societário',
      FINANCEIRO: 'Financeiro',
    };

    const SETOR_CORES: Record<string, string> = {
      FISCAL: '#6366f1',
      PESSOAL: '#ec4899',
      CONTABIL: '#14b8a6',
      TRIBUTARIO: '#f59e0b',
      SOCIETARIO: '#8b5cf6',
      FINANCEIRO: '#06b6d4',
    };

    const documentosPorSetor = setorAgg.map((g) => ({
      nome: SETOR_LABELS[g.sector] ?? g.sector,
      valor: g._count.id,
      cor: SETOR_CORES[g.sector] ?? '#6b7280',
    }));

    return NextResponse.json({ documentosPorMes, documentosPorSetor });
  } catch (err) {
    logger.error('[GET /dashboard/cliente/charts] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['CLIENT']);
