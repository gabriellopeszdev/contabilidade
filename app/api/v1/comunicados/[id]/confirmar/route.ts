import { NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }       from '../../../../../../src/infrastructure/di/Container';
import { logger }       from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = withAuth(async (_req, ctx: ResolvedRouteContext, auth) => {
  try {
    const { id } = ctx.params;

    const dest = await prisma.comunicadoDestinatario.findUnique({
      where:   { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
      include: { comunicado: { select: { exigeConfirmacao: true, deletedAt: true } } },
    });

    if (!dest || dest.comunicado.deletedAt) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }
    if (!dest.comunicado.exigeConfirmacao) {
      return NextResponse.json({ message: 'Este comunicado não exige confirmação.' }, { status: 400 });
    }
    if (dest.confirmado) {
      return NextResponse.json({ ok: true }); // idempotente
    }

    await prisma.comunicadoDestinatario.update({
      where: { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
      data:  { confirmado: true, confirmadoAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PATCH /comunicados/[id]/confirmar] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['CLIENT']);
