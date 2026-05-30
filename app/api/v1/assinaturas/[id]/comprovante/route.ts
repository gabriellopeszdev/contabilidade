import { NextResponse }                                          from 'next/server';
import { withAuth, type ResolvedRouteContext }                   from '@/infrastructure/http/middlewares/withAuth';
import { prisma, storageService }                                from '@/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where:  { id },
    select: { solicitanteId: true, status: true, comprovanteStoragePath: true, documento: { select: { fileName: true } } },
  });

  if (!assinatura) {
    return NextResponse.json({ message: 'Assinatura não encontrada' }, { status: 404 });
  }

  if (assinatura.solicitanteId !== auth.sub) {
    return NextResponse.json({ message: 'Sem permissão' }, { status: 403 });
  }

  if (assinatura.status !== 'ASSINADO' || !assinatura.comprovanteStoragePath) {
    return NextResponse.json({ message: 'Comprovante não disponível' }, { status: 404 });
  }

  const { url } = await storageService.gerarPresignedUrlDownload(assinatura.comprovanteStoragePath, 300);

  return NextResponse.redirect(url);
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
