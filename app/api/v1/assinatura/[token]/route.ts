import { NextRequest, NextResponse } from 'next/server';
import { prisma, emailService } from '@/infrastructure/di/Container';
import { checkRateLimit, getClientIp } from '@/utils/rateLimiter';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where: { tokenAssinatura: token },
    select: {
      id:             true,
      status:         true,
      expiresAt:      true,
      signatarioNome: true,
      provider:       true,
      linkExterno:    true,
      documento: { select: { fileName: true, fileType: true } },
    },
  });

  if (!assinatura) return NextResponse.json({ message: 'Link inválido' }, { status: 404 });

  if (assinatura.status !== 'PENDENTE') {
    return NextResponse.json({ message: 'Este link já foi utilizado', status: assinatura.status }, { status: 410 });
  }

  if (new Date() > assinatura.expiresAt) {
    await prisma.assinaturaDocumento.update({
      where: { id: assinatura.id },
      data: { status: 'EXPIRADO' },
    });
    return NextResponse.json({ message: 'Link expirado' }, { status: 410 });
  }

  return NextResponse.json({
    nomeDocumento:  assinatura.documento.fileName,
    signatarioNome: assinatura.signatarioNome,
    expiresAt:      assinatura.expiresAt,
    provider:       assinatura.provider,
    linkExterno:    assinatura.linkExterno ?? null,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`assinatura:${ip}`, 10, 60 * 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

  const { token } = await params;

  const body = await req.json().catch(() => ({})) as { confirmacao?: boolean; motivoRecusa?: string };
  const { confirmacao, motivoRecusa } = body;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where: { tokenAssinatura: token },
    include: {
      documento: { select: { fileName: true } },
    },
  });

  if (!assinatura || assinatura.status !== 'PENDENTE' || new Date() > assinatura.expiresAt) {
    return NextResponse.json({ message: 'Link inválido ou expirado' }, { status: 410 });
  }

  const novoStatus = confirmacao ? 'ASSINADO' : 'RECUSADO';

  await prisma.assinaturaDocumento.update({
    where: { id: assinatura.id },
    data: {
      status: novoStatus,
      ...(confirmacao
        ? { assinadoAt: new Date(), ipAssinatura: ip }
        : { motivoRecusa: motivoRecusa ?? 'Recusado pelo signatário' }),
    },
  });

  // Notifica o solicitante por e-mail (fire-and-forget)
  const solicitante = await prisma.usuarioContador.findUnique({
    where: { id: assinatura.solicitanteId },
    select: { email: true, name: true },
  }).catch(() => null);

  if (solicitante) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    emailService.enviarStatusAssinatura({
      emailSolicitante: solicitante.email,
      nomeSolicitante:  solicitante.name,
      nomeDocumento:    assinatura.documento.fileName,
      nomeSignatario:   assinatura.signatarioNome,
      status:           novoStatus as 'ASSINADO' | 'RECUSADO',
      motivoRecusa:     confirmacao ? undefined : (motivoRecusa ?? 'Recusado pelo signatário'),
      urlPortal:        `${appUrl}/lote`,
    }).catch(() => {});
  }

  return NextResponse.json({
    message: confirmacao ? 'Documento assinado com sucesso' : 'Assinatura recusada',
  });
}
