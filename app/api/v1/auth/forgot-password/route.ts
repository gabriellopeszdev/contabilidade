import { NextRequest, NextResponse } from 'next/server';
import { randomBytes }               from 'node:crypto';
import { prisma, emailService }      from '../../../../../src/infrastructure/di/Container';
import { logger }                    from '../../../../../src/utils/logger';
import { checkRateLimit, getClientIp } from '../../../../../src/utils/rateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESET_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 horas

// POST /api/v1/auth/forgot-password
// Body: { email: string }
// Resposta: sempre 200 { ok: true } (não revela se e-mail existe)
export async function POST(req: NextRequest) {
  // Rate limiting — 3 tentativas por IP a cada hora
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`forgot:${ip}`, 3, 60 * 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas solicitações de recuperação. Tente novamente em 1 hora.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ message: 'Body inválido.' }, { status: 400 }); }

    const { email } = body as { email?: string };
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ message: 'E-mail é obrigatório.' }, { status: 400 });
    }

    const contador = await prisma.usuarioContador.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: { id: true, email: true },
    });

    // Sempre retorna 200 para não revelar se o e-mail existe
    if (!contador) {
      return NextResponse.json({ ok: true });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);

    await prisma.usuarioContador.update({
      where: { id: contador.id },
      data:  { resetToken: token, resetTokenExpiresAt: expiresAt },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const link   = `${appUrl}/auth/recuperar-senha/${token}`;

    try {
      await emailService.enviarRecuperacaoSenha({ email: contador.email, link });
    } catch (emailErr) {
      logger.error('[POST /auth/forgot-password] Falha ao enviar e-mail.', emailErr instanceof Error ? emailErr : undefined);
    }

    logger.info('[POST /auth/forgot-password] Token gerado.', { contadorId: contador.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /auth/forgot-password] Erro interno.', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
