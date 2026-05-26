import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { solicitacaoAssinaturaHtml } from '@/infrastructure/email/templates/solicitacaoAssinatura';

const resend = new Resend(process.env.RESEND_API_KEY);
const EXPIRACAO_HORAS = 72;

export const POST = withAuth(async (req, ctx, auth) => {
  const { id: documentoId } = ctx.params;
  const body = await req.json();
  const { signatarioId } = body as { signatarioId: string };

  if (!signatarioId) {
    return NextResponse.json({ message: 'signatarioId é obrigatório' }, { status: 400 });
  }

  const [documento, cliente] = await Promise.all([
    prisma.documentoFiscal.findUnique({
      where: { id: documentoId, deletedAt: null },
      select: { fileName: true, fileHash: true, clientId: true },
    }),
    prisma.usuarioCliente.findUnique({
      where: { id: signatarioId },
      select: { name: true, email: true },
    }),
  ]);

  if (!documento) return NextResponse.json({ message: 'Documento não encontrado' }, { status: 404 });
  if (!cliente)   return NextResponse.json({ message: 'Cliente não encontrado' }, { status: 404 });

  const token     = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRACAO_HORAS * 60 * 60 * 1000);
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const assinatura = await prisma.assinaturaDocumento.create({
    data: {
      documentoId,
      solicitanteId:   auth.sub,
      signatarioId,
      signatarioEmail: cliente.email,
      signatarioNome:  cliente.name,
      tokenAssinatura: token,
      hashDocumento:   documento.fileHash,
      expiresAt,
    },
  });

  const linkAssinatura = `${appUrl}/assinar/${token}`;

  await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@konto.app',
    to:      cliente.email,
    subject: `Assinatura solicitada: ${documento.fileName}`,
    html:    solicitacaoAssinaturaHtml({
      nomeCliente:    cliente.name,
      nomeContador:   'Seu escritório contábil',
      nomeDocumento:  documento.fileName,
      linkAssinatura,
      expiracaoHoras: EXPIRACAO_HORAS,
    }),
  });

  return NextResponse.json({ assinaturaId: assinatura.id, expiresAt });
}, ['ACCOUNTANT', 'EMPLOYEE']);

export const GET = withAuth(async (req, ctx) => {
  const { id: documentoId } = ctx.params;

  const assinaturas = await prisma.assinaturaDocumento.findMany({
    where: { documentoId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      signatarioNome: true,
      signatarioEmail: true,
      status: true,
      expiresAt: true,
      assinadoAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ assinaturas });
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
