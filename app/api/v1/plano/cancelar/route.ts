import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/plano/cancelar
// Cancela a assinatura ativa do contador logado.
export const POST = withAuth(async (_req, _ctx, auth) => {
  try {
    const assinatura = await prisma.assinaturaSaaS.findUnique({
      where: { escritorioId: auth.sub },
    });

    if (!assinatura) {
      return NextResponse.json({ message: 'Nenhuma assinatura ativa encontrada.' }, { status: 404 });
    }

    if (assinatura.status === 'CANCELADO') {
      return NextResponse.json({ message: 'Assinatura já está cancelada.' }, { status: 400 });
    }

    await prisma.assinaturaSaaS.update({
      where: { escritorioId: auth.sub },
      data:  { status: 'CANCELADO' },
    });

    logger.info('[POST /plano/cancelar] Assinatura cancelada.', { contadorId: auth.sub });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /plano/cancelar] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
