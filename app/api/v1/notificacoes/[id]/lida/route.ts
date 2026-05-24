import { NextRequest, NextResponse } from 'next/server';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PATCH /api/v1/notificacoes/:id/lida
//
// Marca uma notificação como lida. Apenas o dono pode marcar.
// =============================================================================

export const PATCH = withAuth(async (_req: NextRequest, ctx: RouteContext, auth) => {
  const { id } = ctx.params as { id: string };

  const updated = await prisma.notificacao.updateMany({
    where: { id, userId: auth.sub },
    data:  { lida: true },
  });

  if (updated.count === 0) {
    return NextResponse.json({ message: 'Notificação não encontrada.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);
