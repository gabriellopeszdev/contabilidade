import { NextRequest, NextResponse } from 'next/server';
import { prisma, storageService } from '@/infrastructure/di/Container';

type Params = { params: Promise<{ token: string }> };

export const runtime = 'nodejs';

// Proxy the raw PDF buffer so the browser's PDF.js can fetch it from the same
// origin (avoiding MinIO presigned-URL CORS issues).
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where:  { tokenAssinatura: token },
    select: { status: true, expiresAt: true, documento: { select: { storagePath: true, fileType: true } } },
  });

  if (
    !assinatura ||
    assinatura.status !== 'PENDENTE' ||
    new Date() > assinatura.expiresAt
  ) {
    return NextResponse.json({ message: 'Link inválido ou expirado' }, { status: 410 });
  }

  if (assinatura.documento.fileType !== 'PDF') {
    return NextResponse.json({ message: 'Documento não é PDF' }, { status: 404 });
  }

  const buffer = await storageService.getBuffer(assinatura.documento.storagePath);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Cache-Control':       'private, no-store',
      'Content-Disposition': 'inline',
    },
  });
}
