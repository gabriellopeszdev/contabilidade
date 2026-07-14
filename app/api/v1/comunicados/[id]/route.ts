import { NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, ctx: ResolvedRouteContext, auth) => {
  try {
    const { id } = ctx.params;

    const comunicado = await prisma.comunicado.findFirst({
      where:   { id, deletedAt: null },
      include: { contador: { select: { id: true, name: true } } },
    });

    if (!comunicado) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }

    if (auth.role === 'ACCOUNTANT') {
      if (comunicado.contadorId !== auth.sub) {
        return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
      }

      let anexoUrl: string | null = null;
      if (comunicado.anexoPath) {
        try {
          const presigned = await storageService.gerarPresignedUrlDownload(comunicado.anexoPath, 3600);
          anexoUrl = presigned.url;
        } catch { /* ignora */ }
      }

      return NextResponse.json({
        id:               comunicado.id,
        titulo:           comunicado.titulo,
        conteudo:         comunicado.conteudo,
        exigeConfirmacao: comunicado.exigeConfirmacao,
        targeting:        comunicado.targeting,
        setor:            comunicado.setor,
        publicadoAt:      comunicado.publicadoAt.toISOString(),
        anexoNome:        comunicado.anexoNome,
        anexoUrl,
      });
    }

    // CLIENT
    const vinculo = await prisma.contadorCliente.findFirst({
      where:  { clienteId: auth.sub, contadorId: comunicado.contadorId },
      select: { assignedAt: true },
    });

    if (!vinculo || comunicado.publicadoAt < vinculo.assignedAt) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }

    // Marca como lido apenas se o cliente já é destinatário (não cria linhas novas)
    await prisma.comunicadoDestinatario.updateMany({
      where: { comunicadoId: id, clienteId: auth.sub, lido: false },
      data:  { lido: true, lidoAt: new Date() },
    });

    const dest = await prisma.comunicadoDestinatario.findUnique({
      where: { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
    });

    let anexoUrl: string | null = null;
    if (comunicado.anexoPath) {
      try {
        const presigned = await storageService.gerarPresignedUrlDownload(comunicado.anexoPath, 3600);
        anexoUrl = presigned.url;
      } catch { /* ignora */ }
    }

    return NextResponse.json({
      id:               comunicado.id,
      titulo:           comunicado.titulo,
      conteudo:         comunicado.conteudo,
      exigeConfirmacao: comunicado.exigeConfirmacao,
      publicadoAt:      comunicado.publicadoAt.toISOString(),
      anexoNome:        comunicado.anexoNome,
      anexoUrl,
      souDestinatario:  dest !== null,
      lido:             dest?.lido ?? false,
      confirmado:       dest?.confirmado ?? false,
    });
  } catch (err) {
    logger.error('[GET /comunicados/[id]] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'CLIENT']);

export const DELETE = withAuth(async (_req, ctx: ResolvedRouteContext, auth) => {
  try {
    const { id } = ctx.params;

    const comunicado = await prisma.comunicado.findFirst({
      where: { id, deletedAt: null, contadorId: auth.sub },
    });

    if (!comunicado) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }

    await prisma.comunicado.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /comunicados/[id]] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
