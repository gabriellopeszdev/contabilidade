import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// DELETE /api/v1/calendario/obrigacoes/:id — Desativa obrigação fiscal
// =============================================================================

export const DELETE = withAuth(async (_req, ctx, auth) => {
  try {
    const id = (ctx.params as { id: string }).id;

    const obrigacao = await prisma.obrigacaoFiscal.findFirst({
      where: { id, contadorId: auth.sub, ativo: true },
    });

    if (!obrigacao) {
      return NextResponse.json({ message: 'Obrigação não encontrada.' }, { status: 404 });
    }

    await prisma.obrigacaoFiscal.update({
      where: { id },
      data: { ativo: false },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /calendario/obrigacoes/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
