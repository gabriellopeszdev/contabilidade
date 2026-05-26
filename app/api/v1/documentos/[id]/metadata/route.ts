import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

export const GET = withAuth(async (req, ctx) => {
  const { id } = ctx.params;

  const doc = await prisma.documentoFiscal.findUnique({
    where: { id, deletedAt: null },
    select: { metadataJson: true, fileType: true },
  });

  if (!doc) return NextResponse.json({ message: 'Documento não encontrado' }, { status: 404 });
  if (doc.fileType !== 'XML') return NextResponse.json({ message: 'Metadata disponível apenas para XMLs' }, { status: 400 });

  return NextResponse.json({ metadata: doc.metadataJson });
}, ['ACCOUNTANT', 'CLIENT', 'EMPLOYEE', 'ADMIN']);
