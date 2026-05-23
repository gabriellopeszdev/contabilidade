import { NextRequest, NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';
import { AsaasService } from '../../../../../../src/infrastructure/asaas/AsaasService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PATCH /api/v1/financeiro/boletos/[id] — Atualiza status do boleto
//
// Apenas ACCOUNTANT (dono) ou ADMIN podem atualizar.
// =============================================================================

export const PATCH = withAuth(async (req, ctx, auth) => {
  try {
    if (auth.role !== 'ACCOUNTANT' && auth.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Apenas o dono do escritório pode alterar boletos.' },
        { status: 403 },
      );
    }

    const { id } = await Promise.resolve(ctx.params);
    const body = await req.json();
    const { status } = body as { status?: string };

    const VALID_STATUSES = ['PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const boleto = await prisma.boletoHonorario.findUnique({ where: { id } });
    if (!boleto) {
      return NextResponse.json({ message: 'Boleto não encontrado.' }, { status: 404 });
    }

    // IDOR: só altera boletos do próprio escritório
    if (boleto.escritorioId !== auth.sub) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    // Sync cancellation with Asaas when applicable
    if (status === 'CANCELADO' && boleto.asaasId) {
      const config = await prisma.configuracaoEscritorio.findUnique({
        where:  { contadorId: auth.sub },
        select: { asaasApiKey: true },
      });
      if (config?.asaasApiKey) {
        const svc = new AsaasService(config.asaasApiKey);
        await svc.cancelarBoleto(boleto.asaasId).catch(() => {});
      }
    }

    const updated = await prisma.boletoHonorario.update({
      where: { id },
      data: { status: status as 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO' },
    });

    return NextResponse.json({
      boleto: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error('[PATCH /financeiro/boletos/[id]] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
