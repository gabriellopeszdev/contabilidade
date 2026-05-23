import { NextResponse } from 'next/server';

import { withAuth } from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../src/utils/logger';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/kanban
//
// Retorna todas as tarefas do Kanban com o nome do cliente (JOIN).
// Suporte a filtro por clienteId via query param.
//
// Query params:
//   clienteId → UUID do cliente (opcional — filtra tarefas desse cliente)
//
// Response 200:
//   { tarefas: TarefaDTO[] }
//
// O front-end (useKanban) agrupa por currentState no cliente.
// =============================================================================

export const GET = withAuth(async (req, _ctx, _auth) => {
  try {
    const { searchParams } = req.nextUrl;
    const clienteId = searchParams.get('clienteId') ?? undefined;

    // Validação simples de UUID se fornecido
    if (clienteId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clienteId)) {
      return NextResponse.json(
        { message: 'clienteId inválido. Deve ser um UUID v4.' },
        { status: 400 },
      );
    }

    const tarefas = await prisma.tarefaKanban.findMany({
      where: {
        ...(clienteId ? { clientId: clienteId } : {}),
      },
      orderBy: [
        { currentState: 'asc' },
        { position: 'asc' },
      ],
    });

    // Buscar nomes dos clientes únicos para o JOIN manual
    const clientIds = [...new Set(tarefas.map((t) => t.clientId))];

    const clientes = clientIds.length > 0
      ? await prisma.usuarioCliente.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];

    const clienteNomeMap = new Map(clientes.map((c) => [c.id, c.name]));

    // Serialização → TarefaDTO (contrato do front-end useKanban.ts)
    const tarefasDTO = tarefas.map((t) => ({
      id:           t.id,
      clientId:     t.clientId,
      clienteNome:  clienteNomeMap.get(t.clientId) ?? null,
      assignedTo:   t.assignedTo,
      documentId:   t.documentId,
      sector:       t.sector,
      title:        t.title,
      description:  t.description,
      currentState: t.currentState,
      priority:     t.priority,
      dueDate:      t.dueDate?.toISOString().split('T')[0] ?? null,
      completedAt:  t.completedAt?.toISOString() ?? null,
      position:     t.position,
      createdAt:    t.createdAt.toISOString(),
      updatedAt:    t.updatedAt.toISOString(),
    }));

    return NextResponse.json({ tarefas: tarefasDTO });
  } catch (err) {
    logger.error('[GET /kanban] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
