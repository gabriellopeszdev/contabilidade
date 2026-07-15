import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

export const GET = withAuth(async (req, ctx, auth) => {
  const { id } = ctx.params;

  const documento = await prisma.documentoFiscal.findFirst({
    where: { id, deletedAt: null },
    select: { clientId: true, sector: true },
  });

  if (!documento) return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });

  if (auth.role === 'CLIENT') {
    if (documento.clientId !== auth.sub) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }
  } else if (auth.role !== 'ADMIN') {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId : auth.sub;
    if (!contadorId) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });

    if (auth.role === 'EMPLOYEE' && auth.vinculo === 'CLIENTE') {
      if (documento.clientId !== auth.superiorId) {
        return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
      }
    } else {
      const vinculo = await prisma.contadorCliente.findUnique({
        where: { contadorId_clienteId: { contadorId, clienteId: documento.clientId } },
      });
      if (!vinculo) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    if (
      auth.role === 'EMPLOYEE' &&
      auth.vinculo === 'ESCRITORIO' &&
      Array.isArray(auth.setores) &&
      auth.setores.length > 0 &&
      !auth.setores.includes('TODOS') &&
      documento.sector &&
      !auth.setores.includes(documento.sector)
    ) {
      return NextResponse.json({ message: 'Sem permissão para este setor.' }, { status: 403 });
    }
  }

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
