import { NextRequest, NextResponse } from 'next/server';
import { prisma }   from '../../../../src/infrastructure/di/Container';
import { withAuth } from '../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/notificacoes
//
// Lista as 50 notificações mais recentes do usuário autenticado.
// Query: ?apenasNaoLidas=true (opcional)
// =============================================================================

export const GET = withAuth(async (req: NextRequest, _ctx: RouteContext, auth) => {
  const { searchParams } = new URL(req.url);
  const apenasNaoLidas = searchParams.get('apenasNaoLidas') === 'true';

  const [items, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: {
        userId: auth.sub,
        ...(apenasNaoLidas ? { lida: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take:    50,
      select: {
        id:        true,
        tipo:      true,
        titulo:    true,
        mensagem:  true,
        lida:      true,
        metadados: true,
        createdAt: true,
      },
    }),
    prisma.notificacao.count({
      where: { userId: auth.sub, lida: false },
    }),
  ]);

  return NextResponse.json({
    items:    items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    naoLidas,
  });
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);
