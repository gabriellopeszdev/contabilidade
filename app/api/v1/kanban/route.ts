import { NextResponse } from 'next/server';

import { withAuth } from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/kanban
//
// Retorna tarefas do Kanban APENAS dos clientes do contador logado (IDOR guard).
// Query params:
//   clienteId → UUID do cliente (opcional — deve pertencer ao contador)
// =============================================================================

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const { searchParams } = req.nextUrl;
    const clienteId = searchParams.get('clienteId') ?? undefined;

    if (clienteId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clienteId)) {
      return NextResponse.json({ message: 'clienteId inválido.' }, { status: 400 });
    }

    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    // Busca todos os clientes do contador — escopo obrigatório
    const vinculos = await prisma.contadorCliente.findMany({
      where:  { contadorId },
      select: { clienteId: true },
    });
    const meusClienteIds = vinculos.map((v) => v.clienteId);

    // Se clienteId foi informado, valida que pertence a este contador
    if (clienteId && !meusClienteIds.includes(clienteId)) {
      return NextResponse.json(
        { message: 'Cliente não encontrado ou não pertence à sua carteira.' },
        { status: 403 },
      );
    }

    // Funcionários só veem tarefas atribuídas a eles (ou sem atribuição)
    const funcionarioFilter = auth.role === 'EMPLOYEE'
      ? { OR: [{ assignedToFuncionarioId: auth.sub }, { assignedToFuncionarioId: null }] }
      : {};

    const tarefas = await prisma.tarefaKanban.findMany({
      where: {
        clientId: clienteId ? clienteId : { in: meusClienteIds },
        ...funcionarioFilter,
      },
      orderBy: [
        { currentState: 'asc' },
        { position:     'asc' },
      ],
    });

    const clientIds      = [...new Set(tarefas.map((t) => t.clientId))];
    const funcionarioIds = [...new Set(tarefas.map((t) => t.assignedToFuncionarioId).filter(Boolean))] as string[];

    const [clientes, funcionarios] = await Promise.all([
      clientIds.length > 0
        ? prisma.usuarioCliente.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
        : [],
      funcionarioIds.length > 0
        ? prisma.funcionario.findMany({ where: { id: { in: funcionarioIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const clienteNomeMap     = new Map(clientes.map((c) => [c.id, c.name]));
    const funcionarioNomeMap = new Map(funcionarios.map((f) => [f.id, f.name]));

    const tarefasDTO = tarefas.map((t) => ({
      id:           t.id,
      clientId:     t.clientId,
      clienteNome:  clienteNomeMap.get(t.clientId) ?? null,
      assignedTo:   t.assignedTo,
      assignedToFuncionarioId:   t.assignedToFuncionarioId,
      assignedToFuncionarioNome: t.assignedToFuncionarioId
        ? (funcionarioNomeMap.get(t.assignedToFuncionarioId) ?? null)
        : null,
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
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
