import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';
import { statusEfetivoIbsCbs, type StatusIbsCbs } from '../../../../../../src/utils/ibsCbs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  status: z.enum(['PENDENTE', 'DENTRO_DAS', 'FORA_DAS', 'NAO_SE_APLICA']),
  observacao: z.string().max(500).optional().nullable(),
});

export const PATCH = withAuth(async (req, ctx, auth) => {
  const clienteId = (ctx.params as { clienteId?: string }).clienteId;
  if (!clienteId) {
    return NextResponse.json({ message: 'ID inválido.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Status inválido.' }, { status: 400 });
  }

  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const vinculo = await prisma.contadorCliente.findUnique({
      where: { contadorId_clienteId: { contadorId, clienteId } },
      select: { clienteId: true },
    });
    if (!vinculo) {
      return NextResponse.json({ message: 'Cliente não encontrado na carteira.' }, { status: 404 });
    }

    const { status, observacao } = parsed.data;
    const updated = await prisma.usuarioCliente.update({
      where: { id: clienteId },
      data: {
        ibsCbsStatus:     status,
        ibsCbsDecididoEm: status === 'PENDENTE' ? null : new Date(),
        ibsCbsObservacao: observacao === undefined ? undefined : (observacao || null),
      },
      select: {
        id:               true,
        name:             true,
        regimeTributario: true,
        ibsCbsStatus:     true,
        ibsCbsDecididoEm: true,
        ibsCbsObservacao: true,
      },
    });

    return NextResponse.json({
      id:         updated.id,
      nome:       updated.name,
      status:     statusEfetivoIbsCbs(updated.regimeTributario, updated.ibsCbsStatus as StatusIbsCbs),
      decididoEm: updated.ibsCbsDecididoEm?.toISOString() ?? null,
      observacao: updated.ibsCbsObservacao,
    });
  } catch (err) {
    logger.error('[PATCH /reforma-ibs-cbs/[clienteId]] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
