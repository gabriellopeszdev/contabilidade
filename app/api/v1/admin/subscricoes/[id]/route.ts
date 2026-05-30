import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { StatusAssinaturaSaaS } from '@prisma/client';

export const runtime = 'nodejs';

// =============================================================================
// PATCH /api/v1/admin/subscricoes/:id — Atualiza dados de uma assinatura
// =============================================================================

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const { id } = ctx.params;

  const body = await req.json() as {
    status?:        string;
    planoId?:       string;
    valorMensal?:   number;
    diaVencimento?: number;
    dataRenovacao?: string;
    observacoes?:   string;
  };

  const sub = await prisma.assinaturaSaaS.update({
    where: { id },
    data: {
      ...(body.status        && { status: body.status as StatusAssinaturaSaaS }),
      ...(body.planoId       && { planoId: body.planoId }),
      ...(body.valorMensal   != null && { valorMensal: body.valorMensal }),
      ...(body.diaVencimento != null && { diaVencimento: body.diaVencimento }),
      ...(body.dataRenovacao && { dataRenovacao: new Date(body.dataRenovacao) }),
      ...(body.observacoes   !== undefined && { observacoes: body.observacoes || null }),
    },
  });

  return NextResponse.json({ id: sub.id });
}, ['ADMIN']);

// =============================================================================
// DELETE /api/v1/admin/subscricoes/:id — Remove uma assinatura
// =============================================================================

export const DELETE = withAuth(async (_req: NextRequest, ctx) => {
  const { id } = ctx.params;
  await prisma.assinaturaSaaS.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}, ['ADMIN']);
