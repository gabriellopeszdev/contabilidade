import { NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '@/infrastructure/http/middlewares/withAuth';
import { prisma, emailService, storageService, docSealService } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';
import { randomBytes } from 'crypto';
import { getPlanInfo, hasFeature, FEATURES } from '@/utils/planLimits';

const EXPIRACAO_HORAS = 72;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/documentos/[id]/assinatura — Solicita assinatura de documento
//
// Fluxo DocSeal (quando DOCSEAL_API_KEY está configurado):
//   1. Baixa o PDF do MinIO como Buffer
//   2. Envia ao DocSeal via /submissions/pdf (base64)
//   3. Armazena submissionId e o link DocSeal em linkExterno
//   4. Envia e-mail ao cliente com o link DocSeal
//
// Fluxo INTERNO (fallback sem DocSeal):
//   1. Gera token aleatório de 96 chars hex
//   2. Link: {APP_URL}/assinar/{token}
//   3. Envia e-mail ao cliente com o link interno
// =============================================================================

export const POST = withAuth(async (req, ctx, auth) => {
  const plan = await getPlanInfo(auth.sub);
  if (!hasFeature(plan, FEATURES.ASSINATURA_ELETRONICA)) {
    return NextResponse.json(
      { message: 'Assinatura eletrônica não está disponível no seu plano. Faça upgrade para o Plano Pro ou superior.' },
      { status: 403 },
    );
  }

  const { id: documentoId } = (ctx as ResolvedRouteContext).params;

  const body = await req.json().catch(() => ({})) as { signatarioId?: string };
  const { signatarioId } = body;

  if (!signatarioId) {
    return NextResponse.json({ message: 'signatarioId é obrigatório' }, { status: 400 });
  }

  const [documento, cliente, vinculo] = await Promise.all([
    prisma.documentoFiscal.findUnique({
      where:  { id: documentoId, deletedAt: null },
      select: { fileName: true, fileHash: true, clientId: true, storagePath: true, fileType: true },
    }),
    prisma.usuarioCliente.findUnique({
      where:  { id: signatarioId },
      select: { name: true, email: true },
    }),
    prisma.contadorCliente.findFirst({
      where: { contadorId: auth.sub, clienteId: signatarioId },
    }),
  ]);

  if (!documento) return NextResponse.json({ message: 'Documento não encontrado' }, { status: 404 });
  if (!cliente)   return NextResponse.json({ message: 'Cliente não encontrado' }, { status: 404 });
  if (!vinculo)   return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });

  if (documento.clientId !== signatarioId) {
    return NextResponse.json({ message: 'Documento não pertence a este cliente.' }, { status: 403 });
  }

  if (documento.fileType !== 'PDF') {
    return NextResponse.json({ message: 'Apenas documentos PDF podem ser assinados.' }, { status: 400 });
  }

  const token      = randomBytes(48).toString('hex');
  const expiresAt  = new Date(Date.now() + EXPIRACAO_HORAS * 60 * 60 * 1000);
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? '';

  let provider:            'INTERNO' | 'DOCSEAL' = 'INTERNO';
  let docsealSubmissionId: number | null         = null;
  let linkAssinatura:      string                = `${appUrl}/assinar/${token}`;

  // ---------------------------------------------------------------------------
  // Tenta integração DocSeal quando configurado
  // ---------------------------------------------------------------------------
  if (docSealService.isConfigured()) {
    try {
      const pdfBuffer = await storageService.getBuffer(documento.storagePath);
      const pdfBase64 = pdfBuffer.toString('base64');

      const result = await docSealService.criarSubmissao(
        documento.fileName,
        pdfBase64,
        cliente.name,
        cliente.email,
      );

      provider            = 'DOCSEAL';
      docsealSubmissionId = result.submissionId;
      linkAssinatura      = result.linkAssinatura;
    } catch (err) {
      logger.error('[POST assinatura] Falha no DocSeal — usando fluxo INTERNO', err instanceof Error ? err : new Error(String(err)));
      // fallback: continua com INTERNO (provider e linkAssinatura já têm os valores padrão)
    }
  }

  // ---------------------------------------------------------------------------
  // Salva o registro independente do provider
  // ---------------------------------------------------------------------------
  const assinatura = await prisma.assinaturaDocumento.create({
    data: {
      documentoId,
      solicitanteId:       auth.sub,
      signatarioId,
      signatarioEmail:     cliente.email,
      signatarioNome:      cliente.name,
      tokenAssinatura:     token,
      hashDocumento:       documento.fileHash,
      expiresAt,
      provider,
      ...(docsealSubmissionId !== null && { docsealSubmissionId }),
      ...(provider === 'DOCSEAL' && { linkExterno: linkAssinatura }),
    },
  });

  // ---------------------------------------------------------------------------
  // Envia e-mail ao signatário com o link de assinatura
  // ---------------------------------------------------------------------------
  await emailService.enviarSolicitacaoAssinatura({
    emailCliente:   cliente.email,
    nomeCliente:    cliente.name,
    nomeDocumento:  documento.fileName,
    linkAssinatura,
    expiracaoHoras: EXPIRACAO_HORAS,
  });

  return NextResponse.json({ assinaturaId: assinatura.id, expiresAt, linkAssinatura });
}, ['ACCOUNTANT', 'EMPLOYEE']);

// =============================================================================
// GET /api/v1/documentos/[id]/assinatura — Lista assinaturas do documento
// =============================================================================

export const GET = withAuth(async (req, ctx) => {
  const { id: documentoId } = (ctx as ResolvedRouteContext).params;

  const assinaturas = await prisma.assinaturaDocumento.findMany({
    where:   { documentoId },
    orderBy: { createdAt: 'desc' },
    select: {
      id:              true,
      signatarioNome:  true,
      signatarioEmail: true,
      status:          true,
      provider:        true,
      expiresAt:       true,
      assinadoAt:      true,
      createdAt:       true,
    },
  });

  return NextResponse.json({ assinaturas });
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
