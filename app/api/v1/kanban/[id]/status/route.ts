import { NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Transições válidas — espelha TarefaKanban.ts (domínio)
// =============================================================================

type EstadoTarefa = 'PENDING' | 'PROCESSING' | 'REVIEW' | 'DONE';

const TRANSICOES_VALIDAS: Readonly<Record<EstadoTarefa, readonly EstadoTarefa[]>> = {
  PENDING:    ['PROCESSING'],
  PROCESSING: ['REVIEW', 'PENDING'],
  REVIEW:     ['DONE', 'PROCESSING'],
  DONE:       [],
};

const ESTADOS_VALIDOS: EstadoTarefa[] = ['PENDING', 'PROCESSING', 'REVIEW', 'DONE'];

// =============================================================================
// PATCH /api/v1/kanban/[id]/status
//
// Atualiza o estado (coluna) de uma tarefa no Kanban.
// Acionado pelo drag-and-drop no front-end.
//
// Body (JSON):
//   { "novoEstado": "PROCESSING" | "REVIEW" | "DONE" | "PENDING" }
//
// Respostas:
//   200 OK              → { tarefa } (tarefa atualizada)
//   400 Bad Request     → estado inválido
//   404 Not Found       → tarefa não encontrada
//   422 Unprocessable   → transição inválida pela state machine
// =============================================================================

export const PATCH = withAuth(async (req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  // --------------------------------------------------------------------------
  // 1. Parse do body
  // --------------------------------------------------------------------------
  let body: { novoEstado?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: 'Corpo da requisição deve ser JSON válido.' },
      { status: 400 },
    );
  }

  const novoEstado = body.novoEstado as EstadoTarefa | undefined;

  if (!novoEstado || !ESTADOS_VALIDOS.includes(novoEstado)) {
    return NextResponse.json(
      {
        message: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  // --------------------------------------------------------------------------
  // 2. Busca a tarefa atual
  // --------------------------------------------------------------------------
  try {
    const tarefa = await prisma.tarefaKanban.findUnique({
      where: { id },
      select: { id: true, currentState: true },
    });

    if (!tarefa) {
      return NextResponse.json(
        { message: 'Tarefa não encontrada.' },
        { status: 404 },
      );
    }

    // ------------------------------------------------------------------------
    // 3. Valida transição na state machine
    // ------------------------------------------------------------------------
    const estadoAtual = tarefa.currentState as EstadoTarefa;
    const transicoesPermitidas = TRANSICOES_VALIDAS[estadoAtual];

    if (!transicoesPermitidas.includes(novoEstado)) {
      return NextResponse.json(
        {
          message: `Transição inválida: "${estadoAtual}" → "${novoEstado}".`,
          transicoesPermitidas,
        },
        { status: 422 },
      );
    }

    // ------------------------------------------------------------------------
    // 4. Atualiza no banco
    // ------------------------------------------------------------------------
    const atualizada = await prisma.tarefaKanban.update({
      where: { id },
      data: {
        currentState: novoEstado,
        ...(novoEstado === 'DONE' ? { completedAt: new Date() } : {}),
      },
    });

    return NextResponse.json({
      tarefa: {
        id:           atualizada.id,
        clientId:     atualizada.clientId,
        assignedTo:   atualizada.assignedTo,
        title:        atualizada.title,
        description:  atualizada.description,
        currentState: atualizada.currentState,
        priority:     atualizada.priority,
        dueDate:      atualizada.dueDate?.toISOString().split('T')[0] ?? null,
        completedAt:  atualizada.completedAt?.toISOString() ?? null,
        position:     atualizada.position,
        createdAt:    atualizada.createdAt.toISOString(),
        updatedAt:    atualizada.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error('[PATCH /kanban/:id/status] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN']);
