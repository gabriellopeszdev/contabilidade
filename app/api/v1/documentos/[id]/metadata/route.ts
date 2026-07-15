import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

export const GET = withAuth(async (req, ctx, auth) => {
  const { id } = ctx.params;

  const doc = await prisma.documentoFiscal.findUnique({
    where: { id, deletedAt: null },
    select: { metadataJson: true, fileType: true, clientId: true, sector: true },
  });

  if (!doc) return NextResponse.json({ message: 'Documento não encontrado' }, { status: 404 });
  if (doc.fileType !== 'XML') return NextResponse.json({ message: 'Metadata disponível apenas para XMLs' }, { status: 400 });

  if (auth.role === 'CLIENT') {
    if (doc.clientId !== auth.sub) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }
  } else if (auth.role !== 'ADMIN') {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId : auth.sub;
    if (!contadorId) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });

    if (auth.role === 'EMPLOYEE' && auth.vinculo === 'CLIENTE') {
      if (doc.clientId !== auth.superiorId) {
        return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
      }
    } else {
      const vinculo = await prisma.contadorCliente.findUnique({
        where: { contadorId_clienteId: { contadorId, clienteId: doc.clientId } },
      });
      if (!vinculo) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    if (
      auth.role === 'EMPLOYEE' &&
      auth.vinculo === 'ESCRITORIO' &&
      Array.isArray(auth.setores) &&
      auth.setores.length > 0 &&
      !auth.setores.includes('TODOS') &&
      doc.sector &&
      !auth.setores.includes(doc.sector)
    ) {
      return NextResponse.json({ message: 'Sem permissão para este setor.' }, { status: 403 });
    }
  }

  return NextResponse.json({ metadata: doc.metadataJson });
}, ['ACCOUNTANT', 'CLIENT', 'EMPLOYEE', 'ADMIN']);
