import { NextResponse } from 'next/server';

import { withAuth }        from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }          from '../../../../../src/infrastructure/di/Container';
import { logger }          from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/nfe/recebidas
//
// Lista todos os arquivos XML enviados pelos clientes deste contador.
// Retorna somente documentos com fileType = 'XML' e deletedAt IS NULL.
//
// Roles permitidos: ACCOUNTANT | EMPLOYEE | ADMIN
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    // 1. Buscar IDs de clientes vinculados a este contador
    const vinculos = await prisma.contadorCliente.findMany({
      where:  { contadorId },
      select: { clienteId: true },
    });

    if (vinculos.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const clienteIds = vinculos.map((v) => v.clienteId);

    // 2. Buscar XMLs enviados pelos próprios clientes (uploadedById === clientId)
    const xmls = await prisma.documentoFiscal.findMany({
      where: {
        clientId:     { in: clienteIds },
        fileType:     'XML',
        deletedAt:    null,
        // exclui XMLs que o próprio contador enviou em nome do cliente
        uploadedById: { in: clienteIds },
      },
      include: {
        cliente: { select: { id: true, name: true, cnpj: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return NextResponse.json({
      items: xmls.map((x) => ({
        id:        x.id,
        fileName:  x.fileName,
        createdAt: x.createdAt.toISOString(),
        cliente: {
          id:   x.cliente.id,
          name: x.cliente.name,
          cnpj: x.cliente.cnpj,
        },
      })),
    });
  } catch (err) {
    logger.error('[GET /nfe/recebidas] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
