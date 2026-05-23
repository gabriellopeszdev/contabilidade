import { NextResponse } from 'next/server';

import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../src/utils/logger';
import { toCSV }    from '../../../../../../src/utils/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/financeiro/boletos/export
//
// Exporta todos os boletos do escritório em formato CSV (RFC 4180).
// Colunas: Cliente, Referência, Valor, Status, Tipo, Vencimento, Criado em
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const escritorioId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const boletos = await prisma.boletoHonorario.findMany({
      where:   { escritorioId },
      select:  {
        mesReferencia: true,
        valor:         true,
        status:        true,
        tipoPagamento: true,
        vencimento:    true,
        createdAt:     true,
        cliente:       { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Cliente', 'Referência', 'Valor', 'Status', 'Tipo', 'Vencimento', 'Criado em'];
    const rows = boletos.map((b) => [
      b.cliente.name,
      b.mesReferencia,
      b.valor.toFixed(2),
      b.status,
      b.tipoPagamento,
      b.vencimento.toISOString().slice(0, 10),
      b.createdAt.toISOString(),
    ]);

    const csv = toCSV(headers, rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="boletos.csv"',
      },
    });
  } catch (err) {
    logger.error('[GET /financeiro/boletos/export] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
