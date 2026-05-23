import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

import { withAuth }             from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, emailService } from '../../../../../../src/infrastructure/di/Container';
import { logger }               from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVITE_EXPIRY_HOURS = 48;

// =============================================================================
// POST /api/v1/clientes/[id]/reenviar-convite
//
// Gera novo inviteToken e reenvia e-mail de convite para clientes ainda não
// ativados. Retorna 400 se a conta já estiver ativada.
// =============================================================================

export const POST = withAuth(async (_req: NextRequest, ctx, auth) => {
  try {
    const { id } = await Promise.resolve(ctx.params as { id: string });

    const relacao = await prisma.contadorCliente.findUnique({
      where: {
        contadorId_clienteId: {
          contadorId: auth.sub,
          clienteId:  id,
        },
      },
      select: {
        cliente: {
          select: {
            id:          true,
            name:        true,
            email:       true,
            activatedAt: true,
          },
        },
      },
    });

    if (!relacao) {
      return NextResponse.json({ message: 'Cliente não encontrado ou não pertence à sua carteira.' }, { status: 404 });
    }

    if (relacao.cliente.activatedAt !== null) {
      return NextResponse.json({ message: 'Conta já ativada.' }, { status: 400 });
    }

    const inviteToken     = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.usuarioCliente.update({
      where: { id },
      data:  { inviteToken, inviteExpiresAt },
    });

    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/auth/ativar-conta?token=${inviteToken}`;

    try {
      await emailService.enviarConviteCliente({
        email: relacao.cliente.email,
        nome:  relacao.cliente.name,
        link:  inviteLink,
      });
    } catch (emailErr) {
      logger.error('[POST /clientes/:id/reenviar-convite] Falha ao enviar e-mail.', emailErr instanceof Error ? emailErr : undefined);
    }

    logger.info('[POST /clientes/:id/reenviar-convite] Convite reenviado.', { clienteId: id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /clientes/:id/reenviar-convite] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
