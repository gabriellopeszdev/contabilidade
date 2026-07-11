import { NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/v1/documentos/[id]/lido — marca documento como lido
export const PATCH = withAuth(async (_req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  const doc = await prisma.documentoFiscal.findFirst({
    where: { id, deletedAt: null, clientId: auth.sub },
    select: { id: true, readStatus: true },
  });

  if (!doc) {
    return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
  }

  if (!doc.readStatus) {
    await prisma.documentoFiscal.update({
      where: { id },
      data: { readStatus: true, readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}, ['CLIENT', 'EMPLOYEE']);

// =============================================================================
// DELETE /api/v1/documentos/[id]
//
// Soft-delete de documento fiscal (define deletedAt = now()).
// O arquivo permanece no MinIO até o offboarding do cliente.
//
// Autorização:
//   ADMIN              → qualquer documento
//   ACCOUNTANT         → documentos de clientes da sua carteira
//   EMPLOYEE escritório → idem, respeitando escopo de setores
//   EMPLOYEE cliente    → negado (403)
// =============================================================================

export const DELETE = withAuth(async (_req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  if (!id?.match(/^[0-9a-f-]{36}$/i)) {
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 });
  }

  if (auth.role === 'EMPLOYEE' && auth.vinculo === 'CLIENTE') {
    return NextResponse.json({ message: 'Acesso negado para este tipo de usuário.' }, { status: 403 });
  }

  try {
    const documento = await prisma.documentoFiscal.findFirst({
      where:  { id, deletedAt: null },
      select: { id: true, clientId: true, sector: true },
    });

    if (!documento) {
      return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
    }

    if (auth.role !== 'ADMIN') {
      const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId : auth.sub;
      if (!contadorId) {
        return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
      }

      const vinculo = await prisma.contadorCliente.findUnique({
        where: { contadorId_clienteId: { contadorId, clienteId: documento.clientId } },
      });

      if (!vinculo) {
        return NextResponse.json({ message: 'Documento não pertence à sua carteira.' }, { status: 403 });
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
        return NextResponse.json(
          { message: `Sem permissão para excluir documentos do setor ${documento.sector}.` },
          { status: 403 },
        );
      }
    }

    await prisma.documentoFiscal.update({
      where: { id: documento.id },
      data:  { deletedAt: new Date() },
    });

    logger.info('[DELETE /documentos/:id] Documento excluído', {
      documentoId: documento.id,
      excluidoPor: auth.sub,
      role:        auth.role,
    });

    return NextResponse.json({ ok: true });

  } catch (err) {
    logger.error('[DELETE /documentos/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
