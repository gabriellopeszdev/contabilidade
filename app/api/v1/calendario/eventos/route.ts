import { NextResponse } from 'next/server';
import { SetorTipo }   from '@prisma/client';
import { withAuth }    from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }      from '../../../../../src/infrastructure/di/Container';
import { logger }      from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/calendario/eventos?mes=YYYY-MM
//
// Retorna eventos do calendário para um mês específico:
//   - Obrigações fiscais cadastradas (recorrentes todo mês)
//   - Tarefas do Kanban com dueDate naquele mês, escopadas aos clientes do contador
//
// Para EMPLOYEE:
//   - Usa o contadorId do superior (superiorId do JWT)
//   - Filtra tarefas pelos setores autorizados (exceto quando tem TODOS)
// =============================================================================

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
    const { searchParams } = req.nextUrl;
    const mesParam = searchParams.get('mes'); // YYYY-MM

    const now = new Date();
    let ano = now.getFullYear();
    let mes = now.getMonth() + 1;

    if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
      const [a, m] = mesParam.split('-').map(Number);
      ano = a;
      mes = m;
    }

    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes   = new Date(ano, mes, 0, 23, 59, 59, 999);

    // Clientes que pertencem a este contador (escopo das tarefas)
    const relacoes = await prisma.contadorCliente.findMany({
      where: { contadorId },
      select: { clienteId: true },
    });
    const clienteIds = relacoes.map((r) => r.clienteId);

    // Filtro de setor para funcionários (TODOS = sem restrição)
    const filtrarSetor =
      auth.role === 'EMPLOYEE' &&
      Array.isArray(auth.setores) &&
      auth.setores.length > 0 &&
      !auth.setores.includes('TODOS');

    const [obrigacoes, tarefas] = await Promise.all([
      prisma.obrigacaoFiscal.findMany({
        where: { contadorId, ativo: true },
        orderBy: { diaVencimento: 'asc' },
      }),

      clienteIds.length === 0
        ? Promise.resolve([])
        : prisma.tarefaKanban.findMany({
            where: {
              clientId: { in: clienteIds },
              dueDate: { gte: inicioMes, lte: fimMes },
              ...(filtrarSetor
                ? { sector: { in: auth.setores as SetorTipo[] } }
                : {}),
            },
            select: {
              id: true,
              title: true,
              currentState: true,
              dueDate: true,
              priority: true,
              sector: true,
              clientId: true,
            },
            orderBy: { dueDate: 'asc' },
          }),
    ]);

    // Nomes dos clientes
    const clienteIdsNasTarefas = [...new Set(tarefas.map((t) => t.clientId))];
    const clientes = clienteIdsNasTarefas.length > 0
      ? await prisma.usuarioCliente.findMany({
          where: { id: { in: clienteIdsNasTarefas } },
          select: { id: true, name: true },
        })
      : [];
    const clienteMap = new Map(clientes.map((c) => [c.id, c.name]));

    // Montar eventos
    const eventos: Array<{
      id: string;
      tipo: 'obrigacao' | 'tarefa';
      titulo: string;
      descricao?: string | null;
      data: string;
      cor: string;
      status?: string;
      prioridade?: string;
      clienteNome?: string;
    }> = [];

    const ultimoDia = fimMes.getDate();
    for (const ob of obrigacoes) {
      const dia = Math.min(ob.diaVencimento, ultimoDia);
      eventos.push({
        id:      `ob-${ob.id}`,
        tipo:    'obrigacao',
        titulo:  ob.nome,
        descricao: ob.descricao,
        data:    new Date(ano, mes - 1, dia).toISOString(),
        cor:     ob.cor,
      });
    }

    for (const t of tarefas) {
      const urgente =
        t.currentState === 'PENDING' &&
        t.dueDate != null &&
        t.dueDate <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1_000);
      eventos.push({
        id:          `task-${t.id}`,
        tipo:        'tarefa',
        titulo:      t.title,
        data:        t.dueDate!.toISOString(),
        cor:         urgente ? '#ef4444' : '#6366f1',
        status:      t.currentState,
        prioridade:  t.priority ?? undefined,
        clienteNome: clienteMap.get(t.clientId) ?? undefined,
      });
    }

    return NextResponse.json({ ano, mes, eventos });
  } catch (err) {
    logger.error('[GET /calendario/eventos] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
