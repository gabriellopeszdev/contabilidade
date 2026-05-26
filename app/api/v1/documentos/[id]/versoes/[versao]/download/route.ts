import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '@/infrastructure/di/Container';

export const GET = withAuth(async (req, ctx) => {
  const { id, versao } = ctx.params;
  const versaoNum = parseInt(versao, 10);
  if (isNaN(versaoNum)) return NextResponse.json({ message: 'Versão inválida' }, { status: 400 });

  const registro = await prisma.documentoVersao.findUnique({
    where: { documentoId_versao: { documentoId: id, versao: versaoNum } },
  });

  if (!registro) return NextResponse.json({ message: 'Versão não encontrada' }, { status: 404 });

  const { url, expiresAt } = await storageService.gerarPresignedUrlDownload(registro.storagePath, 300);

  return NextResponse.json({ url, expiresAt: expiresAt.toISOString() });
}, ['ACCOUNTANT', 'CLIENT', 'EMPLOYEE', 'ADMIN']);
