import { NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETORES_VALIDOS = ['FISCAL', 'PESSOAL', 'CONTABIL'] as const;
type SetorDocumento = (typeof SETORES_VALIDOS)[number];

// =============================================================================
// PATCH /api/v1/documentos/[id]/setor
//
// Atualiza a categoria (setor) de um documento enviado pelo cliente.
// Também sincroniza o setor nas tarefas Kanban vinculadas ao documento.
// =============================================================================

export const PATCH = withAuth(async (req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  let body: { sector?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'JSON inválido.' }, { status: 400 });
  }

  const novoSetor = body.sector?.toUpperCase() as SetorDocumento | undefined;
  if (!novoSetor || !SETORES_VALIDOS.includes(novoSetor)) {
    return NextResponse.json(
      { message: `Setor inválido. Valores permitidos: ${SETORES_VALIDOS.join(', ')}.` },
      { status: 400 },
    );
  }

  // Funcionário de cliente não pode alterar categoria de documento.
  if (auth.role === 'EMPLOYEE' && auth.vinculo === 'CLIENTE') {
    return NextResponse.json({ message: 'Acesso negado para este tipo de usuário.' }, { status: 403 });
  }

  try {
    const documento = await prisma.documentoFiscal.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, clientId: true, sector: true },
    });

    if (!documento) {
      return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
    }

    // Admin pode atualizar qualquer documento; contador/funcionário precisa vínculo com cliente.
    if (auth.role !== 'ADMIN') {
      const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId : auth.sub;
      if (!contadorId) {
        return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
      }

      const vinculo = await prisma.contadorCliente.findUnique({
        where: {
          contadorId_clienteId: {
            contadorId,
            clienteId: documento.clientId,
          },
        },
      });

      if (!vinculo) {
        return NextResponse.json({ message: 'Documento não pertence à sua carteira.' }, { status: 403 });
      }

      // Se for funcionário de escritório com setores restritos, respeita o escopo.
      if (
        auth.role === 'EMPLOYEE' &&
        auth.vinculo === 'ESCRITORIO' &&
        Array.isArray(auth.setores) &&
        auth.setores.length > 0 &&
        !auth.setores.includes('TODOS') &&
        !auth.setores.includes(novoSetor)
      ) {
        return NextResponse.json(
          { message: `Você não tem permissão para classificar no setor ${novoSetor}.` },
          { status: 403 },
        );
      }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const docAtualizado = await tx.documentoFiscal.update({
        where: { id: documento.id },
        data: { sector: novoSetor },
        select: { id: true, sector: true, updatedAt: true },
      });

      const tarefas = await tx.tarefaKanban.updateMany({
        where: { documentId: documento.id },
        data: { sector: novoSetor },
      });

      return {
        documento: docAtualizado,
        tarefasAtualizadas: tarefas.count,
      };
    });

    return NextResponse.json({
      documento: {
        id: resultado.documento.id,
        sector: resultado.documento.sector,
        updatedAt: resultado.documento.updatedAt.toISOString(),
      },
      tarefasAtualizadas: resultado.tarefasAtualizadas,
    });
  } catch (err) {
    logger.error('[PATCH /documentos/:id/setor] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
