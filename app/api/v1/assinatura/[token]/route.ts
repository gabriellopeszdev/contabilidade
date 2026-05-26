import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/di/Container';

type Params = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where: { tokenAssinatura: token },
    include: { documento: { select: { fileName: true, fileType: true } } },
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
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown';

  const body = await req.json().catch(() => ({})) as { confirmacao?: boolean; motivoRecusa?: string };
  const { confirmacao, motivoRecusa } = body;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where: { tokenAssinatura: token },
  });

  if (!assinatura || assinatura.status !== 'PENDENTE' || new Date() > assinatura.expiresAt) {
    return NextResponse.json({ message: 'Link inválido ou expirado' }, { status: 410 });
  }

  if (!confirmacao) {
    await prisma.assinaturaDocumento.update({
      where: { id: assinatura.id },
      data: {
        status: 'RECUSADO',
        motivoRecusa: motivoRecusa ?? 'Recusado pelo signatário',
      },
    });
    return NextResponse.json({ message: 'Assinatura recusada' });
  }

  await prisma.assinaturaDocumento.update({
    where: { id: assinatura.id },
    data: { status: 'ASSINADO', assinadoAt: new Date(), ipAssinatura: ip },
  });

  return NextResponse.json({ message: 'Documento assinado com sucesso' });
}
