import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '@/infrastructure/di/Container';

export const GET = withAuth(async (req, ctx, auth) => {
  const { id, versao } = ctx.params;
  const versaoNum = parseInt(versao, 10);
  if (isNaN(versaoNum)) return NextResponse.json({ message: 'Versão inválida' }, { status: 400 });

  const registro = await prisma.documentoVersao.findUnique({
    where: { documentoId_versao: { documentoId: id, versao: versaoNum } },
    include: { documento: { select: { fileName: true, clientId: true, sector: true } } },
  });

  if (!registro) return NextResponse.json({ message: 'Versão não encontrada' }, { status: 404 });

  const { documento } = registro;

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

  const { url, expiresAt } = await storageService.gerarPresignedUrlDownload(
    registro.storagePath,
    300,
    documento.fileName,
  );

  return NextResponse.json({ url, expiresAt: expiresAt.toISOString() });
}, ['ACCOUNTANT', 'CLIENT', 'EMPLOYEE', 'ADMIN']);
