import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { AsaasService } from '../../../../../../src/infrastructure/asaas/AsaasService';
import { logger } from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// DELETE /api/v1/admin/faturamento/[id] — Cancela uma cobrança SaaS
// =============================================================================
export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  try {
    const id = ctx.params?.id;
    if (!id) {
      return NextResponse.json({ message: 'ID da cobrança é obrigatório.' }, { status: 400 });
    }

    const cobranca = await prisma.cobrancaSaaS.findUnique({
      where: { id },
    });

    if (!cobranca) {
      return NextResponse.json({ message: 'Cobrança não encontrada.' }, { status: 404 });
    }

    const saasKey = process.env.ASAAS_SAAS_API_KEY;
    if (!saasKey) {
      return NextResponse.json({ message: 'ASAAS_SAAS_API_KEY não configurada.' }, { status: 503 });
    }

    if (cobranca.asaasPaymentId) {
      const svc = new AsaasService(saasKey);
      await svc.cancelarBoleto(cobranca.asaasPaymentId).catch((err) => {
        logger.warn('[DELETE /admin/faturamento/[id]] Falha ao cancelar no Asaas', err);
      });
    }

    await prisma.cobrancaSaaS.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });

    return NextResponse.json({ message: 'Cobrança cancelada com sucesso.' });
  } catch (err) {
    logger.error('[DELETE /admin/faturamento/[id]] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
