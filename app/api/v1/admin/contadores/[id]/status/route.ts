import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma }            from '../../../../../../../src/infrastructure/di/Container';
import { logger }            from '../../../../../../../src/utils/logger';
import { withAuth }                  from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import type { ResolvedRouteContext } from '../../../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PATCH /api/v1/admin/contadores/[id]/status
//
// Bloqueia ou desbloqueia o acesso de um contador ao sistema.
// Nunca exclui o registro — usa soft disable via isActive.
//
// Body JSON: { isActive: boolean }
//
// Regras de negócio:
//   - Não é permitido bloquear um contador que seja admin (isAdmin: true)
//   - Não é permitido bloquear a si mesmo (auth.sub === params.id)
//
// Acesso: role ADMIN apenas
// =============================================================================

const StatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive é obrigatório e deve ser booleano.' }),
});

export const PATCH = withAuth(
  async (req: NextRequest, ctx: ResolvedRouteContext, auth) => {
    const { id } = ctx.params;

    if (!id) {
      return NextResponse.json({ message: 'ID do contador é obrigatório.' }, { status: 400 });
    }

    // Não permite bloquear a si mesmo
    if (auth.sub === id) {
      return NextResponse.json(
        { message: 'Não é permitido bloquear a própria conta de administrador.' },
        { status: 403 },
      );
    }

    // Validação do body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: 'Body deve ser JSON válido.' }, { status: 400 });
    }

    const parse = StatusSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { message: parse.error.errors[0]?.message ?? 'Dados inválidos.' },
        { status: 422 },
      );
    }

    const { isActive } = parse.data;

    try {
      // Busca o contador garantindo que não seja outro admin
      const contador = await prisma.usuarioContador.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, name: true, isAdmin: true },
      });

      if (!contador) {
        return NextResponse.json({ message: 'Contador não encontrado.' }, { status: 404 });
      }

      if (contador.isAdmin) {
        return NextResponse.json(
          { message: 'Não é permitido alterar o status de outro administrador.' },
          { status: 403 },
        );
      }

      await prisma.usuarioContador.update({
        where: { id },
        data:  { isActive },
      });

      logger.info('[PATCH /admin/contadores/:id/status] Status atualizado.', {
        contadorId: id,
        isActive,
        adminId:    auth.sub,
      });

      return NextResponse.json({ id, isActive });
    } catch (err) {
      logger.error('[PATCH /admin/contadores/:id/status] Erro interno', err instanceof Error ? err : { err });
      return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
    }
  },
  ['ADMIN'],
);
