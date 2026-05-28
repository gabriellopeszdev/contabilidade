import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, _ctx, auth) => {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status'); // PENDENTE | ASSINADO | RECUSADO | EXPIRADO | null (all)

  const assinaturas = await prisma.assinaturaDocumento.findMany({
    where: {
      solicitanteId: auth.sub,
      ...(status ? { status: status as 'PENDENTE' | 'ASSINADO' | 'RECUSADO' | 'EXPIRADO' } : {}),
    },
    select: {
      id:              true,
      status:          true,
      signatarioNome:  true,
      signatarioEmail: true,
      expiresAt:       true,
      assinadoAt:      true,
      motivoRecusa:    true,
      createdAt:       true,
      tokenAssinatura: true,
      documento: {
        select: { id: true, fileName: true, fileType: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const agora = new Date();

  return NextResponse.json({
    assinaturas: assinaturas.map((a) => ({
      id:              a.id,
      status:          a.status === 'PENDENTE' && agora > a.expiresAt ? 'EXPIRADO' : a.status,
      signatarioNome:  a.signatarioNome,
      signatarioEmail: a.signatarioEmail,
      expiresAt:       a.expiresAt.toISOString(),
      assinadoAt:      a.assinadoAt?.toISOString() ?? null,
      motivoRecusa:    a.motivoRecusa ?? null,
      createdAt:       a.createdAt.toISOString(),
      tokenAssinatura: a.tokenAssinatura,
      documentoId:     a.documento.id,
      documentoNome:   a.documento.fileName,
      documentoTipo:   a.documento.fileType,
    })),
  });
}, ['ACCOUNTANT', 'ADMIN']);
