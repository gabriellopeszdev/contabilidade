import { NextRequest, NextResponse } from 'next/server';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PATCH /api/v1/notificacoes/todas-lidas
//
// Marca todas as notificações do usuário como lidas.
// =============================================================================

export const PATCH = withAuth(async (_req: NextRequest, _ctx: RouteContext, auth) => {
  await prisma.notificacao.updateMany({
    where: { userId: auth.sub, lida: false },
    data:  { lida: true },
  });

  return NextResponse.json({ ok: true });
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);
