import { NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/v1/documentos/[id]/lido — marca documento como lido
export const PATCH = withAuth(async (_req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  const doc = await prisma.documentoFiscal.findFirst({
    where: { id, deletedAt: null, clientId: auth.sub },
    select: { id: true, readStatus: true },
  });

  if (!doc) {
    return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
  }

  if (!doc.readStatus) {
    await prisma.documentoFiscal.update({
      where: { id },
      data: { readStatus: true, readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}, ['CLIENT', 'EMPLOYEE']);
