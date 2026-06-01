import { NextRequest, NextResponse } from 'next/server';
import { prisma }  from '../../../../../src/infrastructure/di/Container';
import { logger }  from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Mapeamento de status Cora → StatusBoleto interno
// Referência: https://developers.cora.com.br (status de invoice)
const STATUS_MAP: Record<string, string> = {
  PENDING:   'PENDENTE',
  PAID:      'PAGO',
  OVERDUE:   'VENCIDO',
  CANCELLED: 'CANCELADO',
  EXPIRED:   'CANCELADO',
};

const PRIORIDADE: Record<string, number> = {
  PENDENTE: 0, VENCIDO: 1, PAGO: 2, CANCELADO: 3,
};

// =============================================================================
// POST /api/v1/webhooks/cora — Recebe eventos do Banco Cora
//
// Validação: token estático via header Authorization (Bearer) ou
// header customizado cora-webhook-token, conforme configurado no portal Cora.
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. Validação do token
    // -------------------------------------------------------------------------
    const webhookToken = process.env.CORA_WEBHOOK_TOKEN;
    if (!webhookToken) {
      logger.warn('[Webhook Cora] CORA_WEBHOOK_TOKEN não configurado — endpoint desprotegido.');
      return NextResponse.json({ message: 'Webhook não configurado.' }, { status: 503 });
    }
    // Cora pode enviar via Authorization: Bearer ou via header customizado
    const authHeader = req.headers.get('authorization') ?? '';
    const customToken = req.headers.get('cora-webhook-token') ?? '';
    const tokenRecebido = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : customToken;

    if (tokenRecebido !== webhookToken) {
      logger.warn('[Webhook Cora] Token inválido.');
      return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // 2. Parse do body
    //    Estrutura esperada do evento Cora (invoice paid/overdue/cancelled)
    // -------------------------------------------------------------------------
    const body = await req.json() as {
      id?:     string;      // event ID
      type?:   string;      // ex: "invoice.paid"
      invoice?: {
        id:     string;     // coraId
        status: string;     // PAID | OVERDUE | CANCELLED | PENDING
        code?:  string;     // externalReference (nosso ID interno)
      };
    };

    const { type, invoice } = body;

    if (!invoice?.id) {
      return NextResponse.json({ ok: true }); // ignora eventos sem invoice
    }

    // -------------------------------------------------------------------------
    // 3. Idempotência
    // -------------------------------------------------------------------------
    const eventKey = `${type ?? 'unknown'}:${invoice.id}`;
    try {
      await prisma.webhookEventLog.create({ data: { eventKey } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ ok: true }); // duplicado
      }
      throw e;
    }

    // -------------------------------------------------------------------------
    // 4. Atualiza status do boleto
    // -------------------------------------------------------------------------
    const novoStatus = STATUS_MAP[invoice.status.toUpperCase()];
    if (!novoStatus) {
      logger.warn('[Webhook Cora] Status desconhecido.', { status: invoice.status });
      return NextResponse.json({ ok: true });
    }

    const boleto = await prisma.boletoHonorario.findFirst({
      where:  { coraId: invoice.id },
      select: { id: true, status: true },
    });

    if (!boleto) {
      logger.warn('[Webhook Cora] Boleto não encontrado.', { coraId: invoice.id });
      return NextResponse.json({ ok: true });
    }

    // Impede retroação de status (ex: PAGO → PENDENTE)
    const prioAtual  = PRIORIDADE[boleto.status]  ?? 0;
    const prioNovo   = PRIORIDADE[novoStatus]      ?? 0;

    if (prioNovo > prioAtual) {
      await prisma.boletoHonorario.update({
        where: { id: boleto.id },
        data:  { status: novoStatus as 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO' },
      });

      logger.info('[Webhook Cora] Status atualizado.', {
        boletoId:   boleto.id,
        coraId:     invoice.id,
        novoStatus,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[Webhook Cora] Erro interno.', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
