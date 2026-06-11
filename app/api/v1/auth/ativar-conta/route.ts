import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { prisma, eventDispatcher } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';
import { checkRateLimit, getClientIp } from '../../../../../src/utils/rateLimiter';
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
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`ativar-conta:${ip}`, 5, 15 * 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

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
        id:              true,
        name:            true,
        email:           true,
        avatarUrl:       true,
        activatedAt:     true,
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

    // Notificar contadores vinculados em tempo real
    const vinculos = await prisma.contadorCliente.findMany({
      where: { clienteId: cliente.id },
      select: { contadorId: true },
    });
    await Promise.allSettled(
      vinculos.map(({ contadorId }) =>
        eventDispatcher.dispatch(
          Object.assign(Object.create(null) as object, {
            eventId:    crypto.randomUUID(),
            eventName:  'ClienteAtivadoEvent',
            occurredAt: new Date(),
            clienteId:  cliente.id,
            contadorId,
          }) as import('../../../../../src/shared/DomainEvent').DomainEvent,
        ),
      ),
    );

    // Atualiza lastLoginAt
    prisma.usuarioCliente.update({
      where: { id: cliente.id },
      data:  { lastLoginAt: new Date() },
    }).catch(() => {});

    // Gera JWT para login automático
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('[POST /auth/ativar-conta] JWT_SECRET não configurado');
      return NextResponse.json({ message: 'Conta ativada com sucesso! Faça login.' });
    }

    const jwt = await new SignJWT({ role: 'CLIENT', nome: cliente.name })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(cliente.id)
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(jwtSecret));

    return NextResponse.json({
      message: 'Conta ativada com sucesso!',
      token: jwt,
      usuario: {
        id:       cliente.id,
        nome:     cliente.name,
        email:    cliente.email,
        role:     'CLIENT',
        avatarUrl: cliente.avatarUrl,
      },
    });
  } catch (err) {
    logger.error('[POST /auth/ativar-conta] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
