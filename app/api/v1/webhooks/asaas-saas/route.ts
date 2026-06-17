import { NextRequest, NextResponse } from 'next/server';
import { prisma }  from '../../../../../src/infrastructure/di/Container';
import { logger }  from '../../../../../src/utils/logger';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mapeamento de eventos de pagamento → Status interno
const EVENTO_STATUS: Record<string, string> = {
  PAYMENT_RECEIVED:             'PAGO',
  PAYMENT_CONFIRMED:            'PAGO',
  PAYMENT_OVERDUE:              'VENCIDO',
  PAYMENT_DELETED:              'CANCELADO',
  PAYMENT_REFUNDED:             'CANCELADO',
  PAYMENT_CHARGEBACK_REQUESTED: 'CANCELADO',
  PAYMENT_CREATED:              'PENDENTE',
};

// Prioridade de status para impedir retroação (ex: PAGO → PENDENTE)
const PRIORIDADE: Record<string, number> = {
  PENDENTE: 0, VENCIDO: 1, PAGO: 2, CANCELADO: 3,
};

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. Validação do token
    // -------------------------------------------------------------------------
    const webhookToken = process.env.ASAAS_SAAS_WEBHOOK_TOKEN;
    if (!webhookToken) {
      logger.warn('[Webhook Asaas-SaaS] ASAAS_SAAS_WEBHOOK_TOKEN não configurado.');
      return NextResponse.json({ message: 'Webhook não configurado.' }, { status: 503 });
    }
    const tokenRecebido = req.headers.get('asaas-access-token') ?? '';
    if (tokenRecebido !== webhookToken) {
      logger.warn('[Webhook Asaas-SaaS] Token inválido recebido.');
      return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // 2. Parse do body
    // -------------------------------------------------------------------------
    const body = await req.json() as {
      event:   string;
      payment?: {
        id:                string;
        status:            string;
        externalReference: string | null;
        value:             number;
        dueDate:           string;
        description:       string | null;
        subscription:      string | null;
        billingType:       string;
        customer:          string;
        invoiceUrl:        string | null;
        bankSlipUrl:       string | null;
      };
      subscription?: {
        id:     string;
        status: string;
      };
    };

    const { event, payment } = body;
    logger.info('[Webhook Asaas-SaaS] Evento recebido', { event, paymentId: payment?.id });

    // -------------------------------------------------------------------------
    // 3. Idempotência
    // -------------------------------------------------------------------------
    const resourceId = payment?.id ?? body.subscription?.id ?? 'unknown';
    const eventKey   = `saas:${event}:${resourceId}`;

    try {
      await prisma.webhookEventLog.create({ data: { eventKey } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ ok: true });
      }
      throw e;
    }

    // -------------------------------------------------------------------------
    // 4. SUBSCRIPTION_INACTIVATED / SUBSCRIPTION_DELETED
    // -------------------------------------------------------------------------
    if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'SUBSCRIPTION_DELETED') {
      const subscriptionId = payment?.subscription ?? body.subscription?.id;
      if (subscriptionId) {
        await prisma.assinaturaSaaS.updateMany({
          where: { asaasSubscriptionId: subscriptionId },
          data:  { status: 'CANCELADO' },
        }).catch(() => {});
        logger.info('[Webhook Asaas-SaaS] Assinatura SaaS inativada no banco.', { event, subscriptionId });
      }
      return NextResponse.json({ ok: true });
    }

    if (!payment) {
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------------------
    // 5. Buscar/Criar CobrancaSaaS
    // -------------------------------------------------------------------------
    // Localizar assinatura pelo ID da assinatura Asaas ou pelo Customer ID
    const assinatura = await prisma.assinaturaSaaS.findFirst({
      where: {
        OR: [
          ...(payment.subscription ? [{ asaasSubscriptionId: payment.subscription }] : []),
          ...(payment.customer ? [{ asaasCustomerId: payment.customer }] : []),
        ],
      },
    });

    if (!assinatura) {
      logger.warn('[Webhook Asaas-SaaS] AssinaturaSaaS correspondente não encontrada.', {
        subscription: payment.subscription,
        customer: payment.customer,
      });
      return NextResponse.json({ ok: true });
    }

    let cobranca = await prisma.cobrancaSaaS.findUnique({
      where: { asaasPaymentId: payment.id },
    });

    const novoStatus = EVENTO_STATUS[event] || 'PENDENTE';

    if (!cobranca) {
      cobranca = await prisma.cobrancaSaaS.create({
        data: {
          assinaturaId:    assinatura.id,
          escritorioId:    assinatura.escritorioId,
          valor:           new Prisma.Decimal(payment.value),
          vencimento:      new Date(payment.dueDate),
          mesReferencia:   payment.dueDate.substring(0, 7),
          status:          novoStatus,
          asaasPaymentId:  payment.id,
          asaasBoletoUrl:  payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
          asaasInvoiceUrl: payment.invoiceUrl ?? null,
          asaasPixPayload: null,
          asaasBarcode:    null,
        },
      });
      logger.info('[Webhook Asaas-SaaS] CobrancaSaaS criada.', { cobrancaId: cobranca.id, status: novoStatus });
    } else {
      // Atualizar status
      const statusAtual = cobranca.status;
      if (statusAtual !== 'PAGO' || (PRIORIDADE[novoStatus] ?? 0) > (PRIORIDADE[statusAtual] ?? 0)) {
        cobranca = await prisma.cobrancaSaaS.update({
          where: { id: cobranca.id },
          data: {
            status: novoStatus,
            asaasBoletoUrl: payment.invoiceUrl ?? payment.bankSlipUrl ?? cobranca.asaasBoletoUrl,
            asaasInvoiceUrl: payment.invoiceUrl ?? cobranca.asaasInvoiceUrl,
          },
        });
        logger.info('[Webhook Asaas-SaaS] CobrancaSaaS atualizada.', { cobrancaId: cobranca.id, status: novoStatus });
      }
    }

    // -------------------------------------------------------------------------
    // 6. Atualizar status da AssinaturaSaaS com base na situação das faturas
    // -------------------------------------------------------------------------
    // Se a cobrança foi paga, vamos marcar como ATIVO.
    // Se ficou vencida (OVERDUE), marcar como INADIMPLENTE.
    if (novoStatus === 'PAGO') {
      await prisma.assinaturaSaaS.update({
        where: { id: assinatura.id },
        data: { status: 'ATIVO' },
      });
      logger.info('[Webhook Asaas-SaaS] AssinaturaSaaS reativada/mantida ATIVO.', { assinaturaId: assinatura.id });
    } else if (novoStatus === 'VENCIDO') {
      await prisma.assinaturaSaaS.update({
        where: { id: assinatura.id },
        data: { status: 'INADIMPLENTE' },
      });
      logger.info('[Webhook Asaas-SaaS] AssinaturaSaaS marcada como INADIMPLENTE.', { assinaturaId: assinatura.id });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[Webhook Asaas-SaaS] Erro interno no processamento', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
