import { NextRequest, NextResponse }   from 'next/server';
import { prisma }                       from '../../../../../src/infrastructure/di/Container';
import { logger }                       from '../../../../../src/utils/logger';
import { BcryptPasswordHasher }         from '../../../../../src/infrastructure/auth/BcryptPasswordHasher';
import { checkRateLimit, getClientIp }  from '../../../../../src/utils/rateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hasher = new BcryptPasswordHasher();

// POST /api/v1/auth/reset-password
// Body: { token: string, novaSenha: string }
export async function POST(req: NextRequest) {
  // Rate limiting — 5 tentativas por IP a cada 15 minutos
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`reset:${ip}`, 5, 15 * 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ message: 'Body inválido.' }, { status: 400 }); }

    const { token, novaSenha } = body as { token?: string; novaSenha?: string };

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ message: 'Token é obrigatório.' }, { status: 400 });
    }
    if (!novaSenha || typeof novaSenha !== 'string' || novaSenha.length < 8) {
      return NextResponse.json({ message: 'A senha deve ter no mínimo 8 caracteres.' }, { status: 422 });
    }

    const contador = await prisma.usuarioContador.findFirst({
      where: { resetToken: token, deletedAt: null },
      select: { id: true, resetTokenExpiresAt: true },
    });

    if (!contador) {
      return NextResponse.json({ message: 'Link de redefinição inválido ou já utilizado.' }, { status: 404 });
    }

    if (contador.resetTokenExpiresAt && contador.resetTokenExpiresAt < new Date()) {
      return NextResponse.json({ message: 'Link expirado. Solicite um novo link de redefinição.' }, { status: 410 });
    }

    const passwordHash = await hasher.hash(novaSenha);

    const redefinicao = await prisma.usuarioContador.updateMany({
      where: { resetToken: token, deletedAt: null },
      data:  {
        passwordHash,
        resetToken:          null,
        resetTokenExpiresAt: null,
      },
    });
    if (redefinicao.count === 0) {
      return NextResponse.json(
        { message: 'Link de redefinição inválido ou já utilizado.' },
        { status: 400 },
      );
    }

    logger.info('[POST /auth/reset-password] Senha redefinida.', { contadorId: contador.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /auth/reset-password] Erro interno.', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
