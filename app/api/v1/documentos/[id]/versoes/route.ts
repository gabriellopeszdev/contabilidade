import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

export const GET = withAuth(async (req, ctx) => {
  const { id } = ctx.params;

  const versoes = await prisma.documentoVersao.findMany({
    where: { documentoId: id },
    orderBy: { versao: 'desc' },
    select: {
      id: true,
      versao: true,
      fileHash: true,
      fileSizeBytes: true,
      uploadedById: true,
      motivo: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    versoes: versoes.map((v) => ({
      ...v,
      fileSizeBytes: v.fileSizeBytes.toString(),
    })),
  });
}, ['ACCOUNTANT', 'CLIENT', 'EMPLOYEE', 'ADMIN']);
