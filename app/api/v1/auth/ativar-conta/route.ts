import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';
import { BcryptPasswordHasher } from '../../../../../src/infrastructure/auth/BcryptPasswordHasher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hasher = new BcryptPasswordHasher();

// =============================================================================
// POST /api/v1/auth/ativar-conta
//
// Ativa uma conta de cliente via invite token + definição de senha.
//
// Body: { token: string, senha: string }
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, senha } = body as { token?: string; senha?: string };

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ message: 'Token é obrigatório.' }, { status: 400 });
    }

    if (!senha || typeof senha !== 'string' || senha.length < 8) {
      return NextResponse.json(
        { message: 'A senha deve ter no mínimo 8 caracteres.' },
        { status: 400 },
      );
    }

    // Buscar cliente pelo invite token
    const cliente = await prisma.usuarioCliente.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        activatedAt: true,
        inviteExpiresAt: true,
      },
    });

    if (!cliente) {
      return NextResponse.json(
        { message: 'Token de convite inválido ou já utilizado.' },
        { status: 404 },
      );
    }

    if (cliente.activatedAt) {
      return NextResponse.json(
        { message: 'Esta conta já foi ativada. Faça login normalmente.' },
        { status: 409 },
      );
    }

    if (cliente.inviteExpiresAt && cliente.inviteExpiresAt < new Date()) {
      return NextResponse.json(
        { message: 'Token de convite expirado. Solicite um novo convite ao seu contador.' },
        { status: 410 },
      );
    }

    // Hash da nova senha
    const passwordHash = await hasher.hash(senha);

    // Ativar conta
    await prisma.usuarioCliente.update({
      where: { id: cliente.id },
      data: {
        passwordHash,
        activatedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    return NextResponse.json({ message: 'Conta ativada com sucesso! Faça login.' });
  } catch (err) {
    logger.error('[POST /auth/ativar-conta] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
