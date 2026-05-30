import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';

// =============================================================================
// PUT /api/v1/admin/planos/:id — Atualiza um plano SaaS
// =============================================================================

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  const { id } = ctx.params;

  const body = await req.json() as {
    nome?:             string;
    descricao?:        string;
    preco?:            number;
    limiteClientes?:   number;
    limiteDocumentos?: number;
    features?:         string[];
    isActive?:         boolean;
  };

  const plano = await prisma.planoSaaS.update({
    where: { id },
    data: {
      ...(body.nome             !== undefined && { nome: body.nome.trim() }),
      ...(body.descricao        !== undefined && { descricao: body.descricao?.trim() || null }),
      ...(body.preco            !== undefined && { preco: body.preco }),
      ...(body.limiteClientes   !== undefined && { limiteClientes: body.limiteClientes }),
      ...(body.limiteDocumentos !== undefined && { limiteDocumentos: body.limiteDocumentos }),
      ...(body.features         !== undefined && { features: body.features }),
      ...(body.isActive         !== undefined && { isActive: body.isActive }),
    },
  });

  return NextResponse.json({ id: plano.id });
}, ['ADMIN']);

// =============================================================================
// DELETE /api/v1/admin/planos/:id — Remove um plano SaaS (somente sem assinantes ativos)
// =============================================================================

export const DELETE = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = ctx.params;

  const count = await prisma.assinaturaSaaS.count({
    where: { planoId: id, status: { in: ['ATIVO', 'TRIAL'] } },
  });

  if (count > 0) {
    return NextResponse.json(
      { message: `Este plano tem ${count} assinante(s) ativo(s). Migre-os antes de excluir.` },
      { status: 409 },
    );
  }

  await prisma.planoSaaS.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}, ['ADMIN']);
