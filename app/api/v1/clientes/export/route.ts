import { NextResponse } from 'next/server';

import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../src/utils/logger';
import { toCSV }    from '../../../../../src/utils/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/clientes/export
//
// Exporta todos os clientes do escritório em formato CSV (RFC 4180).
// Colunas: Nome, Email, CNPJ, Status, Ativado em, Criado em
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const relacoes = await prisma.contadorCliente.findMany({
      where: { contadorId, cliente: { deletedAt: null } },
      select: {
        cliente: {
          select: {
            name:        true,
            email:       true,
            cnpj:        true,
            activatedAt: true,
            createdAt:   true,
          },
        },
      },
      orderBy: { cliente: { name: 'asc' } },
    });

    const headers = ['Nome', 'Email', 'CNPJ', 'Status', 'Ativado em', 'Criado em'];
    const rows = relacoes.map((r) => {
      const c = r.cliente;
      return [
        c.name,
        c.email,
        c.cnpj,
        c.activatedAt ? 'Ativo' : 'Pendente',
        c.activatedAt ? c.activatedAt.toISOString() : '',
        c.createdAt.toISOString(),
      ];
    });

    const csv = toCSV(headers, rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="clientes.csv"',
      },
    });
  } catch (err) {
    logger.error('[GET /clientes/export] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
