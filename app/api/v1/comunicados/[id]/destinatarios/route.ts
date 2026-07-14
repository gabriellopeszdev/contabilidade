import { NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }       from '../../../../../../src/infrastructure/di/Container';
import { logger }       from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, ctx: ResolvedRouteContext, auth) => {
  try {
    const { id } = ctx.params;

    const comunicado = await prisma.comunicado.findFirst({
      where: { id, contadorId: auth.sub, deletedAt: null },
    });

    if (!comunicado) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }

    const destinatarios = await prisma.comunicadoDestinatario.findMany({
      where:   { comunicadoId: id },
      include: { cliente: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({
      items: destinatarios.map((d) => ({
        clienteId:    d.clienteId,
        nome:         d.cliente.name,
        email:        d.cliente.email,
        lido:         d.lido,
        lidoAt:       d.lidoAt?.toISOString() ?? null,
        confirmado:   d.confirmado,
        confirmadoAt: d.confirmadoAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    logger.error('[GET /comunicados/[id]/destinatarios] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
