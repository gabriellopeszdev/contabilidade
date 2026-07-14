import { NextRequest, NextResponse } from 'next/server';
import { prisma, storageService, emailService } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';
import { timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/webhooks/zapsign — Recebe eventos da ZapSign
//
// Validação: comparação simples do header customizado X-Zapsign-Webhook-Secret
// com o valor configurado em ZAPSIGN_WEBHOOK_SECRET (timing-safe).
//
// Idempotência: eventKey = `zapsign:{token}:{event_type}` no WebhookEventLog.
// O mesmo docToken pode gerar múltiplos eventos ao longo do tempo, por isso
// o event_type compõe a chave.
//
// Eventos tratados:
//   - doc_signed   → baixar signed_file, salvar MinIO, marcar ASSINADO
//   - doc_refused  → marcar RECUSADO com motivo
//   - doc_expired  → marcar EXPIRADO
//   - doc_created  → só logar
//   - doc_deleted  → só logar
//   - email_bounce → logar warning
// =============================================================================

const WEBHOOK_SECRET = process.env.ZAPSIGN_WEBHOOK_SECRET ?? '';

function verificarSecret(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) {
    logger.warn('[Webhook ZapSign] ZAPSIGN_WEBHOOK_SECRET não configurado — rejeitando.');
    return false;
  }

  const received = req.headers.get('x-zapsign-webhook-secret') ?? '';

  try {
    const expected = Buffer.from(WEBHOOK_SECRET);
    const actual   = Buffer.from(received);
    return (
      expected.length === actual.length &&
      timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

type ZapSignPayload = {
  event_type:      string;
  token:           string;
  external_id?:    string | null;
  status?:         string;
  signed_file?:    string | null;
  rejected_reason?: string;
  deleted?:        boolean;
  deleted_at?:     string;
  expiration_date?: string;
  signer_who_signed?: { name?: string; email?: string; signed_at?: string; cpf?: string };
  signers?:        Array<{ token: string; status: string; name: string; email: string }>;
  // email_bounce specific
  email?:          string;
  type?:           string;
  delivered?:      boolean;
  error?:          string;
};

export async function POST(req: NextRequest) {
  try {
    if (!verificarSecret(req)) {
      logger.warn('[Webhook ZapSign] Secret inválido ou ausente.');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody) as ZapSignPayload;

    const { event_type: eventType, token: docToken, external_id: externalId } = payload;

    logger.info('[Webhook ZapSign] Evento recebido', { eventType, docToken });

    // Idempotência
    const eventKey = `zapsign:${docToken}:${eventType}`;
    const existingEvent = await prisma.webhookEventLog.findUnique({ where: { eventKey } });
    if (existingEvent) {
      logger.info('[Webhook ZapSign] Evento já processado (idempotência)', { eventKey });
      return NextResponse.json({ ok: true });
    }

    // Buscar AssinaturaDocumento por zapsignDocToken ou external_id
    let assinatura = await prisma.assinaturaDocumento.findFirst({
      where: { zapsignDocToken: docToken },
      include: { documento: { select: { fileName: true, clientId: true } } },
    });

    if (!assinatura && externalId) {
      assinatura = await prisma.assinaturaDocumento.findUnique({
        where: { id: externalId },
        include: { documento: { select: { fileName: true, clientId: true } } },
      });
    }

    if (!assinatura) {
      logger.warn('[Webhook ZapSign] AssinaturaDocumento não encontrada', { docToken, externalId });
      await prisma.webhookEventLog.create({ data: { eventKey } });
      return NextResponse.json({ ok: true, warning: 'Assinatura não encontrada' });
    }

    // -------------------------------------------------------------------------
    // Processar evento
    // -------------------------------------------------------------------------
    switch (eventType) {
      case 'doc_signed': {
        const signedFileUrl = payload.signed_file;

        if (signedFileUrl) {
          try {
            const pdfResponse = await fetch(signedFileUrl);
            if (!pdfResponse.ok) throw new Error(`Falha ao baixar PDF assinado: ${pdfResponse.status}`);
            const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

            const storagePath = `assinaturas/${assinatura.id}/documento-assinado.pdf`;
            await storageService.upload(storagePath, pdfBuffer, 'application/pdf');

            await prisma.assinaturaDocumento.update({
              where: { id: assinatura.id },
              data:  {
                status:                 'ASSINADO',
                assinadoAt:             new Date(),
                comprovanteStoragePath: storagePath,
              },
            });

            logger.info('[Webhook ZapSign] Documento assinado e salvo no MinIO', {
              assinaturaId: assinatura.id,
              storagePath,
            });

            // Notificar contador
            try {
              const solicitante = await prisma.usuarioContador.findUnique({
                where:  { id: assinatura.solicitanteId },
                select: { email: true, name: true },
              });
              if (solicitante) {
                await emailService.enviarStatusAssinatura({
                  emailSolicitante: solicitante.email,
                  nomeSolicitante:  solicitante.name,
                  nomeDocumento:    assinatura.documento.fileName,
                  nomeSignatario:   assinatura.signatarioNome,
                  status:           'ASSINADO',
                  urlPortal:        process.env.NEXT_PUBLIC_APP_URL ?? '',
                });
              }
            } catch (emailErr) {
              logger.error('[Webhook ZapSign] Falha ao enviar e-mail de notificação',
                emailErr instanceof Error ? emailErr : new Error(String(emailErr)));
            }

            await prisma.auditLog.create({
              data: {
                userId:       assinatura.solicitanteId,
                actionType:   'ASSINATURA_CONCLUIDA',
                resourceType: 'ASSINATURA',
                detailsJson:  { assinaturaId: assinatura.id, documentoId: assinatura.documentoId, provider: 'ZAPSIGN', docToken },
                ipAddress:    '0.0.0.0',
              },
            });
          } catch (err) {
            logger.error('[Webhook ZapSign] Erro ao processar doc_signed',
              err instanceof Error ? err : new Error(String(err)));
            return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
          }
        }
        break;
      }

      case 'doc_refused': {
        const motivo = payload.rejected_reason ?? 'Recusado pelo signatário';
        await prisma.assinaturaDocumento.update({
          where: { id: assinatura.id },
          data:  { status: 'RECUSADO', motivoRecusa: motivo },
        });

        logger.info('[Webhook ZapSign] Assinatura recusada', { assinaturaId: assinatura.id, motivo });

        try {
          const solicitante = await prisma.usuarioContador.findUnique({
            where:  { id: assinatura.solicitanteId },
            select: { email: true, name: true },
          });
          if (solicitante) {
            await emailService.enviarStatusAssinatura({
              emailSolicitante: solicitante.email,
              nomeSolicitante:  solicitante.name,
              nomeDocumento:    assinatura.documento.fileName,
              nomeSignatario:   assinatura.signatarioNome,
              status:           'RECUSADO',
              motivoRecusa:     motivo,
              urlPortal:        process.env.NEXT_PUBLIC_APP_URL ?? '',
            });
          }
        } catch (emailErr) {
          logger.error('[Webhook ZapSign] Falha ao enviar e-mail de recusa',
            emailErr instanceof Error ? emailErr : new Error(String(emailErr)));
        }

        await prisma.auditLog.create({
          data: {
            userId:       assinatura.solicitanteId,
            actionType:   'ASSINATURA_RECUSADA',
            resourceType: 'ASSINATURA',
            detailsJson:  { assinaturaId: assinatura.id, documentoId: assinatura.documentoId, provider: 'ZAPSIGN', docToken, motivo },
            ipAddress:    '0.0.0.0',
          },
        });
        break;
      }

      case 'doc_expired': {
        await prisma.assinaturaDocumento.update({
          where: { id: assinatura.id },
          data:  { status: 'EXPIRADO' },
        });
        logger.info('[Webhook ZapSign] Assinatura expirada', { assinaturaId: assinatura.id });
        break;
      }

      case 'doc_created':
      case 'doc_deleted':
        logger.info('[Webhook ZapSign] Evento informativo — sem ação necessária', { eventType, docToken });
        break;

      case 'email_bounce':
        logger.warn('[Webhook ZapSign] Falha no envio de e-mail ao signatário', {
          email:   payload.email,
          docToken: payload.token,
          status:  payload.status,
          error:   payload.error,
        });
        break;

      default:
        logger.info('[Webhook ZapSign] Evento não tratado', { eventType });
    }

    await prisma.webhookEventLog.create({ data: { eventKey } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[Webhook ZapSign] Erro inesperado', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
