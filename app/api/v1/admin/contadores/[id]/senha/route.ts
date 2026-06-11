import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma }               from '../../../../../../../src/infrastructure/di/Container';
import { logger }               from '../../../../../../../src/utils/logger';
import { BcryptPasswordHasher } from '../../../../../../../src/infrastructure/auth/BcryptPasswordHasher';
import { withAuth }             from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext }    from '../../../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hasher = new BcryptPasswordHasher();

const schema = z.object({
  novaSenha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
});

// =============================================================================
// PATCH /api/v1/admin/contadores/[id]/senha
// Redefine a senha de um contador sem exigir a senha atual.
// Acesso: role ADMIN apenas.
// =============================================================================

export const PATCH = withAuth(async (req: NextRequest, ctx: RouteContext) => {
  try {
    const { id } = await ctx.params;

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0].message },
        { status: 400 },
      );
    }

    const contador = await prisma.usuarioContador.findFirst({
      where: { id, deletedAt: null, isAdmin: false },
      select: { id: true },
    });

    if (!contador) {
      return NextResponse.json({ message: 'Contador não encontrado.' }, { status: 404 });
    }

    const passwordHash = await hasher.hash(parsed.data.novaSenha);

    await prisma.usuarioContador.update({
      where: { id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    logger.info(`[PATCH /admin/contadores/${id}/senha] Senha redefinida pelo admin.`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PATCH /admin/contadores/[id]/senha] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
