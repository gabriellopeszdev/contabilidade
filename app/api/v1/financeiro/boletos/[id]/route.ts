import { NextRequest, NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, emailService } from '../../../../../../src/infrastructure/di/Container';
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

    const boleto = await prisma.boletoHonorario.findUnique({
      where:   { id },
      include: { cliente: { select: { name: true, email: true, notifEmailBoleto: true } } },
    });
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
        await svc.cancelarBoleto(boleto.asaasId).catch((err: unknown) => {
          logger.error('[PATCH boletos] Falha ao sincronizar cancelamento no Asaas', err instanceof Error ? err : undefined);
        });
      }
    }

    const updated = await prisma.boletoHonorario.update({
      where: { id },
      data: { status: status as 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO' },
    });

    // Email de confirmação de pagamento
    if (status === 'PAGO' && boleto.cliente.notifEmailBoleto && boleto.cliente.email) {
      const valorFmt = `R$ ${Number(boleto.valor).toFixed(2).replace('.', ',')}`;
      const { emailWrapper, emailHeading, emailSubheading, emailText, emailInfoBox, emailCallout, emailButton } =
        await import('../../../../../../src/infrastructure/email/emailTemplate');
      emailService.enviar({
        destinatario: boleto.cliente.email,
        assunto:      `Pagamento confirmado — ${boleto.mesReferencia} (${valorFmt})`,
        corpoHtml: emailWrapper(
          emailSubheading('Pagamento Confirmado') +
          emailHeading('Seu pagamento foi recebido!') +
          emailText(`Olá, <strong>${boleto.cliente.name}</strong>! Confirmamos o recebimento do seu pagamento de honorários.`) +
          emailInfoBox([
            { label: 'Referência', value: boleto.mesReferencia },
            { label: 'Valor',      value: valorFmt },
            { label: 'Status',     value: 'Pago ✓' },
          ]) +
          emailCallout('Guarde este e-mail como comprovante. Obrigado pela pontualidade!', '✅', '#f0fdf4', '#bbf7d0') +
          emailButton('Acessar Portal', process.env.NEXT_PUBLIC_APP_URL ?? ''),
        ),
      }).catch(() => {});
    }

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
