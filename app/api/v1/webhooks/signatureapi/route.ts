import { NextRequest, NextResponse } from 'next/server';
import { prisma, storageService, emailService } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/webhooks/signatureapi — Recebe eventos da SignatureAPI
//
// A SignatureAPI utiliza a especificação "Standard Webhooks":
//   - Header `webhook-id`: ID único do evento
//   - Header `webhook-timestamp`: Unix timestamp do envio
//   - Header `webhook-signature`: `v1,<base64-hmac-sha256>`
//
// Eventos tratados:
//   - `deliverable.generated` → PDF assinado pronto para download
//   - `recipient.rejected`    → Signatário recusou a assinatura
//   - `envelope.canceled`     → Envelope cancelado
//
// Referência: https://www.standardwebhooks.com
// =============================================================================

const WEBHOOK_SECRET = process.env.SIGNATUREAPI_WEBHOOK_SECRET ?? '';
const TOLERANCE_SECONDS = 300; // 5 minutos de tolerância para replay attacks

/**
 * Valida a assinatura do webhook seguindo a especificação Standard Webhooks.
 */
function verificarAssinatura(
  rawBody: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
): boolean {
  if (!WEBHOOK_SECRET) {
    logger.warn('[Webhook SignatureAPI] SIGNATUREAPI_WEBHOOK_SECRET não configurado — pulando verificação');
    return true; // Em desenvolvimento, permite sem verificação
  }

  // Verificar timestamp para prevenir replay attacks
  const timestamp = parseInt(webhookTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) {
    logger.warn('[Webhook SignatureAPI] Timestamp fora da tolerância', { timestamp, now });
    return false;
  }

  // Calcular HMAC-SHA256
  // Standard Webhooks: o segredo pode ter prefixo "whsec_" que deve ser removido
  let secret = WEBHOOK_SECRET;
  if (secret.startsWith('whsec_')) {
    secret = secret.slice(6);
  }

  const secretBytes = Buffer.from(secret, 'base64');
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expectedSignature = createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // O header pode ter múltiplas assinaturas separadas por espaço: "v1,sig1 v1,sig2"
  const signatures = webhookSignature.split(' ');
  for (const sig of signatures) {
    const [version, hash] = sig.split(',');
    if (version !== 'v1') continue;

    try {
      const expected = Buffer.from(expectedSignature, 'base64');
      const received = Buffer.from(hash, 'base64');
      if (expected.length === received.length && timingSafeEqual(expected, received)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookId = req.headers.get('webhook-id') ?? '';
    const webhookTimestamp = req.headers.get('webhook-timestamp') ?? '';
    const webhookSignature = req.headers.get('webhook-signature') ?? '';

    // Validar assinatura
    if (!verificarAssinatura(rawBody, webhookId, webhookTimestamp, webhookSignature)) {
      logger.warn('[Webhook SignatureAPI] Assinatura inválida', { webhookId });
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
    }

    // Idempotência — verificar se o evento já foi processado
    const existingEvent = await prisma.webhookEventLog.findUnique({
      where: { eventKey: `signatureapi:${webhookId}` },
    });

    if (existingEvent) {
      logger.info('[Webhook SignatureAPI] Evento já processado (idempotência)', { webhookId });
      return NextResponse.json({ ok: true });
    }

    const payload = JSON.parse(rawBody) as {
      type: string;
      data: {
        id?: string;
        envelope_id?: string;
        url?: string;
        metadata?: Record<string, string>;
        envelope_metadata?: Record<string, string>;
        recipient?: {
          name?: string;
          email?: string;
        };
      };
    };

    const { type: eventType, data } = payload;
    logger.info('[Webhook SignatureAPI] Evento recebido', { eventType, webhookId });

    // Extrair assinaturaId dos metadados (a SignatureAPI envia no webhook como envelope_metadata)
    const assinaturaId = data.envelope_metadata?.assinaturaId ?? data.metadata?.assinaturaId;
    const envelopeId = data.envelope_id ?? data.id;

    // Buscar a assinatura correspondente
    let assinatura = null;
    if (assinaturaId) {
      assinatura = await prisma.assinaturaDocumento.findUnique({
        where: { id: assinaturaId },
        include: {
          documento: { select: { fileName: true, clientId: true } },
        },
      });
    }

    // Fallback: buscar pelo envelopeId
    if (!assinatura && envelopeId) {
      assinatura = await prisma.assinaturaDocumento.findFirst({
        where: { signatureapiEnvelopeId: envelopeId },
        include: {
          documento: { select: { fileName: true, clientId: true } },
        },
      });
    }

    if (!assinatura) {
      logger.warn('[Webhook SignatureAPI] Assinatura não encontrada', { assinaturaId, envelopeId });
      // Retornar 200 para evitar retries da SignatureAPI
      return NextResponse.json({ ok: true, warning: 'Assinatura não encontrada' });
    }

    // -------------------------------------------------------------------------
    // Processar evento
    // -------------------------------------------------------------------------

    switch (eventType) {
      case 'deliverable.generated': {
        // PDF assinado pronto para download
        if (data.url) {
          try {
            // Baixar o PDF assinado
            const pdfResponse = await fetch(data.url);
            if (!pdfResponse.ok) {
              throw new Error(`Falha ao baixar PDF: ${pdfResponse.status}`);
            }
            const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

            // Salvar no MinIO
            const storagePath = `assinaturas/${assinatura.id}/documento-assinado.pdf`;
            await storageService.upload(storagePath, pdfBuffer, 'application/pdf');

            // Atualizar registro
            await prisma.assinaturaDocumento.update({
              where: { id: assinatura.id },
              data: {
                status: 'ASSINADO',
                assinadoAt: new Date(),
                comprovanteStoragePath: storagePath,
              },
            });

            logger.info('[Webhook SignatureAPI] Documento assinado e salvo', {
              assinaturaId: assinatura.id,
              storagePath,
            });

            // Notificar o contador (solicitante)
            try {
              const solicitante = await prisma.usuarioContador.findUnique({
                where: { id: assinatura.solicitanteId },
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
              logger.error('[Webhook SignatureAPI] Falha ao enviar e-mail de notificação', 
                emailErr instanceof Error ? emailErr : new Error(String(emailErr)));
            }

            // Registrar audit log
            await prisma.auditLog.create({
              data: {
                userId: assinatura.solicitanteId,
                actionType: 'ASSINATURA_CONCLUIDA',
                resourceType: 'ASSINATURA',
                detailsJson: {
                  assinaturaId: assinatura.id,
                  documentoId: assinatura.documentoId,
                  provider: 'SIGNATUREAPI',
                  envelopeId,
                },
                ipAddress: '0.0.0.0', // Webhook — sem IP de usuário
              },
            });
          } catch (err) {
            logger.error('[Webhook SignatureAPI] Erro ao processar deliverable.generated', 
              err instanceof Error ? err : new Error(String(err)));
            return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
          }
        }
        break;
      }

      case 'recipient.rejected':
      case 'envelope.canceled': {
        // Signatário recusou ou envelope foi cancelado
        await prisma.assinaturaDocumento.update({
          where: { id: assinatura.id },
          data: {
            status: 'RECUSADO',
            motivoRecusa: `Evento: ${eventType}`,
          },
        });

        logger.info('[Webhook SignatureAPI] Assinatura recusada/cancelada', {
          assinaturaId: assinatura.id,
          eventType,
        });

        // Notificar o contador
        try {
          const solicitante = await prisma.usuarioContador.findUnique({
            where: { id: assinatura.solicitanteId },
            select: { email: true, name: true },
          });

          if (solicitante) {
            await emailService.enviarStatusAssinatura({
              emailSolicitante: solicitante.email,
              nomeSolicitante:  solicitante.name,
              nomeDocumento:    assinatura.documento.fileName,
              nomeSignatario:   assinatura.signatarioNome,
              status:           'RECUSADO',
              motivoRecusa:     `Evento: ${eventType}`,
              urlPortal:        process.env.NEXT_PUBLIC_APP_URL ?? '',
            });
          }
        } catch (emailErr) {
          logger.error('[Webhook SignatureAPI] Falha ao enviar e-mail de recusa', 
            emailErr instanceof Error ? emailErr : new Error(String(emailErr)));
        }

        // Registrar audit log
        await prisma.auditLog.create({
          data: {
            userId: assinatura.solicitanteId,
            actionType: 'ASSINATURA_RECUSADA',
            resourceType: 'ASSINATURA',
            detailsJson: {
              assinaturaId: assinatura.id,
              documentoId: assinatura.documentoId,
              provider: 'SIGNATUREAPI',
              eventType,
              envelopeId,
            },
            ipAddress: '0.0.0.0',
          },
        });
        break;
      }

      default:
        logger.info('[Webhook SignatureAPI] Evento não tratado', { eventType });
    }

    // Registrar evento para idempotência
    await prisma.webhookEventLog.create({
      data: { eventKey: `signatureapi:${webhookId}` },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[Webhook SignatureAPI] Erro inesperado', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
