import { NextRequest, NextResponse } from 'next/server';
import { prisma }  from '../../../../../src/infrastructure/di/Container';
import { logger }  from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mapeamento de eventos de pagamento → StatusBoleto interno
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

// =============================================================================
// POST /api/v1/webhooks/asaas — Recebe eventos do Asaas
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. Validação do token
    // -------------------------------------------------------------------------
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!webhookToken) {
      logger.warn('[Webhook Asaas] ASAAS_WEBHOOK_TOKEN não configurado — endpoint desprotegido.');
      return NextResponse.json({ message: 'Webhook não configurado.' }, { status: 503 });
    }
    const tokenRecebido = req.headers.get('asaas-access-token') ?? '';
    if (tokenRecebido !== webhookToken) {
      logger.warn('[Webhook Asaas] Token inválido recebido.');
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
        value?:            number;
        dueDate?:          string;
        description?:      string | null;
        subscription?:     string | null;
        billingType?:      string;
        customer?:         string;
        invoiceUrl?:       string | null;
        bankSlipUrl?:      string | null;
      };
      subscription?: {
        id:     string;
        status: string;
      };
    };

    const { event, payment } = body;

    // -------------------------------------------------------------------------
    // 3. Idempotência — cada evento é processado no máximo uma vez
    //    Chave: "{eventType}:{paymentId | subscriptionId | unknown}"
    // -------------------------------------------------------------------------
    const resourceId = payment?.id ?? body.subscription?.id ?? 'unknown';
    const eventKey   = `${event}:${resourceId}`;

    try {
      await prisma.webhookEventLog.create({ data: { eventKey } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        // Unique constraint → evento duplicado (retry do Asaas)
        return NextResponse.json({ ok: true });
      }
      throw e;
    }

    // -------------------------------------------------------------------------
    // 4. Eventos de ciclo de assinatura
    // -------------------------------------------------------------------------
    if (event === 'SUBSCRIPTION_INACTIVATED' || event === 'SUBSCRIPTION_DELETED') {
      const subscriptionId = payment?.subscription ?? body.subscription?.id;
      if (subscriptionId) {
        await prisma.assinaturaHonorario.updateMany({
          where: { asaasId: subscriptionId },
          data:  { asaasStatus: 'INACTIVE' },
        }).catch(() => {});
        logger.info('[Webhook Asaas] Assinatura inativada.', { event, subscriptionId });
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------------------
    // 5. Eventos de estorno em andamento ou negado (sem mudança de status)
    // -------------------------------------------------------------------------
    if (event === 'PAYMENT_REFUND_IN_PROGRESS' || event === 'PAYMENT_REFUND_DENIED') {
      logger.info('[Webhook Asaas] Evento de estorno recebido.', { event, paymentId: payment?.id });
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------------------
    // 6. PAYMENT_CREATED via assinatura → cria BoletoHonorario automaticamente
    // -------------------------------------------------------------------------
    if (event === 'PAYMENT_CREATED' && payment?.subscription) {
      try {
        const assinatura = await prisma.assinaturaHonorario.findFirst({
          where: { asaasId: payment.subscription },
        });
        if (assinatura && payment.dueDate) {
          await prisma.boletoHonorario.create({
            data: {
              clienteId:          assinatura.clienteId,
              escritorioId:       assinatura.escritorioId,
              valor:              assinatura.valor,
              vencimento:         new Date(payment.dueDate),
              mesReferencia:      payment.dueDate.substring(0, 7),
              descricao:          payment.description ?? assinatura.descricao ?? null,
              asaasId:            payment.id,
              asaasBoletoUrl:     payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
              tipoPagamento:      assinatura.tipoPagamento,
              asaasSubscriptionId: payment.subscription,
            },
          });
          logger.info('[Webhook Asaas] BoletoHonorario criado via assinatura.', {
            assinaturaId: assinatura.id,
            paymentId:    payment.id,
          });
        }
      } catch (subErr) {
        logger.warn('[Webhook Asaas] Falha ao criar boleto via assinatura.', { err: subErr });
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------------------
    // 7. Eventos que alteram status de pagamento
    // -------------------------------------------------------------------------
    const novoStatus = EVENTO_STATUS[event];
    if (!novoStatus) {
      return NextResponse.json({ ok: true });
    }

    if (!payment?.externalReference && !payment?.id) {
      return NextResponse.json({ ok: true });
    }

    const boleto = await prisma.boletoHonorario.findFirst({
      where: {
        OR: [
          ...(payment?.id                ? [{ asaasId: payment.id }]              : []),
          ...(payment?.externalReference ? [{ id: payment.externalReference }]    : []),
        ],
      },
    });

    if (!boleto) {
      logger.warn('[Webhook Asaas] Boleto não encontrado.', {
        asaasId: payment?.id,
        extRef:  payment?.externalReference,
      });
      return NextResponse.json({ ok: true });
    }

    // Não retroage status (ex: PAGO não volta para PENDENTE)
    if ((PRIORIDADE[novoStatus] ?? 0) <= (PRIORIDADE[boleto.status] ?? 0) && boleto.status === 'PAGO') {
      return NextResponse.json({ ok: true });
    }

    await prisma.boletoHonorario.update({
      where: { id: boleto.id },
      data:  { status: novoStatus as 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO' },
    });

    logger.info('[Webhook Asaas] Status atualizado.', {
      boletoId: boleto.id,
      evento:   event,
      status:   novoStatus,
    });

    // Notificar via Redis → WebSocket
    try {
      const { redisPublisher } = await import('../../../../../src/infrastructure/di/Container');
      await redisPublisher.publish('domain_events', JSON.stringify({
        eventName: 'BoletoStatusAtualizadoEvent',
        payload: {
          boletoId:  boleto.id,
          clienteId: boleto.clienteId,
          status:    novoStatus,
          valor:     Number(boleto.valor),
        },
      }));
    } catch { /* notificação não bloqueia */ }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[Webhook Asaas] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
