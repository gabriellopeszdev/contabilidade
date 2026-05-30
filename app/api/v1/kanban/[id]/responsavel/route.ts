import { NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PATCH /api/v1/kanban/[id]/responsavel
//
// Atribui (ou remove) um funcionário responsável por uma tarefa Kanban.
// Body: { funcionarioId: string | null }
// =============================================================================

export const PATCH = withAuth(async (req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  let body: { funcionarioId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'JSON inválido.' }, { status: 400 });
  }

  const funcionarioId = body.funcionarioId ?? null;

  try {
    const tarefa = await prisma.tarefaKanban.findUnique({
      where:  { id },
      select: { id: true, clientId: true },
    });

    if (!tarefa) {
      return NextResponse.json({ message: 'Tarefa não encontrada.' }, { status: 404 });
    }

    const contadorId = auth.sub;
    const vinculo = await prisma.contadorCliente.findUnique({
      where: { contadorId_clienteId: { contadorId, clienteId: tarefa.clientId } },
    });
    if (!vinculo) {
      return NextResponse.json({ message: 'Sem permissão.' }, { status: 403 });
    }

    // Valida que o funcionario pertence ao mesmo escritório
    if (funcionarioId) {
      const func = await prisma.funcionario.findFirst({
        where: { id: funcionarioId, contadorId, deletedAt: null },
        select: { id: true },
      });
      if (!func) {
        return NextResponse.json({ message: 'Funcionário não encontrado.' }, { status: 404 });
      }
    }

    const atualizada = await prisma.tarefaKanban.update({
      where: { id },
      data:  { assignedToFuncionarioId: funcionarioId },
    });

    return NextResponse.json({ assignedToFuncionarioId: atualizada.assignedToFuncionarioId });
  } catch (err) {
    logger.error('[PATCH /kanban/:id/responsavel] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
