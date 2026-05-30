import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/webhooks/docseal — Receptor de eventos do DocSeal
//
// DocSeal assina cada requisição de webhook com HMAC-SHA256.
// Header: X-Docuseal-Signature: {timestamp}.{hmac_hex}
// Segredo: DOCSEAL_WEBHOOK_SECRET (configurado no painel DocSeal)
//
// Evento tratado: form.completed
//   status="completed" → ASSINADO
//   status="declined"  → RECUSADO
// =============================================================================

interface DocSealWebhookBody {
  event_type: string;
  data: {
    submission: {
      id:     number;
      status: string;
    };
    submitter: {
      id:     number;
      email:  string;
      status: string;  // "completed" | "declined"
    };
  };
}

function verificarAssinatura(rawBody: string, signatureHeader: string, secret: string): boolean {
  // Formato: "{timestamp}.{hmac_hex}"
  const dotIndex = signatureHeader.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp   = signatureHeader.slice(0, dotIndex);
  const receivedSig = signatureHeader.slice(dotIndex + 1);

  const payload  = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret  = process.env.DOCSEAL_WEBHOOK_SECRET ?? '';
  const rawBody = await req.text();

  if (secret) {
    const sig = req.headers.get('x-docuseal-signature') ?? '';
    if (!verificarAssinatura(rawBody, sig, secret)) {
      logger.warn('[DocSeal webhook] Assinatura inválida');
      return NextResponse.json({ message: 'Assinatura inválida' }, { status: 401 });
    }
  }

  let body: DocSealWebhookBody;
  try {
    body = JSON.parse(rawBody) as DocSealWebhookBody;
  } catch {
    return NextResponse.json({ message: 'JSON inválido' }, { status: 400 });
  }

  if (body.event_type !== 'form.completed') {
    return NextResponse.json({ ok: true });
  }

  const submissionId  = body.data.submission.id;
  const statusDocSeal = body.data.submitter.status;
  const novoStatus    = statusDocSeal === 'completed' ? 'ASSINADO' : 'RECUSADO';

  const assinatura = await prisma.assinaturaDocumento.findFirst({
    where: { docsealSubmissionId: submissionId, status: 'PENDENTE' },
  });

  if (!assinatura) {
    logger.warn('[DocSeal webhook] Submission não encontrado ou já processado', { submissionId });
    return NextResponse.json({ ok: true });
  }

  await prisma.assinaturaDocumento.update({
    where: { id: assinatura.id },
    data: {
      status:    novoStatus,
      ...(novoStatus === 'ASSINADO' && { assinadoAt: new Date() }),
    },
  });

  logger.info('[DocSeal webhook] Status atualizado', { submissionId, novoStatus });
  return NextResponse.json({ ok: true });
}
