import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/calendario/instancias/:id/concluir — Marca instância como concluída
// =============================================================================

export const POST = withAuth(async (_req, ctx) => {
  const id = (ctx.params as { id: string }).id;

  const instancia = await prisma.instanciaObrigacao.findUnique({ where: { id } });
  if (!instancia) {
    return NextResponse.json({ message: 'Instância não encontrada' }, { status: 404 });
  }

  await prisma.instanciaObrigacao.update({
    where: { id },
    data: { concluida: true, concluidaEm: new Date() },
  });

  return NextResponse.json({ message: 'Obrigação marcada como concluída' });
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
