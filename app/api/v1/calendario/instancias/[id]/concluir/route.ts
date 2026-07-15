import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/calendario/instancias/:id/concluir — Marca instância como concluída
// =============================================================================

export const POST = withAuth(async (_req, ctx, auth) => {
  const id = (ctx.params as { id: string }).id;

  const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId : auth.sub;
  if (!contadorId) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });

  const resultado = await prisma.instanciaObrigacao.updateMany({
    where: { id, contadorId, concluida: false },
    data:  { concluida: true, concluidaEm: new Date() },
  });

  if (resultado.count === 0) {
    return NextResponse.json(
      { message: 'Instância não encontrada ou já concluída.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ message: 'Obrigação marcada como concluída' });
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
