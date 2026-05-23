import { NextResponse } from 'next/server';
import { withAuth }     from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }       from '../../../../../../../src/infrastructure/di/Container';
import { AsaasService } from '../../../../../../../src/infrastructure/asaas/AsaasService';
import { logger }       from '../../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/financeiro/boletos/[id]/estorno
export const POST = withAuth(async (req, ctx, auth) => {
  try {
    if (auth.role !== 'ACCOUNTANT' && auth.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    const { id } = await Promise.resolve(ctx.params);
    const body   = await req.json().catch(() => ({})) as { valor?: number };

    const boleto = await prisma.boletoHonorario.findUnique({ where: { id } });
    if (!boleto) {
      return NextResponse.json({ message: 'Boleto não encontrado.' }, { status: 404 });
    }
    if (boleto.escritorioId !== auth.sub) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }
    if (boleto.status !== 'PAGO') {
      return NextResponse.json({ message: 'Apenas boletos pagos podem ser estornados.' }, { status: 400 });
    }
    if (!boleto.asaasId) {
      return NextResponse.json({ message: 'Boleto sem integração Asaas — estorno manual necessário.' }, { status: 400 });
    }

    const config = await prisma.configuracaoEscritorio.findUnique({
      where:  { contadorId: auth.sub },
      select: { asaasApiKey: true },
    });
    if (!config?.asaasApiKey) {
      return NextResponse.json({ message: 'Integração Asaas não configurada.' }, { status: 400 });
    }

    const svc = new AsaasService(config.asaasApiKey);
    await svc.estornarPagamento(boleto.asaasId, body.valor);

    // Não altera o status aqui — o Asaas enviará PAYMENT_REFUNDED via webhook
    // quando o estorno for concluído, atualizando para CANCELADO automaticamente.
    return NextResponse.json({
      ok: true,
      mensagem: 'Estorno solicitado. O status será atualizado quando o Asaas confirmar o crédito.',
    });
  } catch (err) {
    logger.error('[POST /financeiro/boletos/[id]/estorno]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
