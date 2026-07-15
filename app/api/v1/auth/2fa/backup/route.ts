import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/infrastructure/di/Container';
import { verifyBackupCode } from '@/lib/totp';
import { checkRateLimit, getClientIp } from '@/utils/rateLimiter';

export async function POST(req: NextRequest) {
  // Rate limit por IP — 10 tentativas a cada 15 min
  const ip = getClientIp(req);
  const rlIp = await checkRateLimit(`2fa:backup:ip:${ip}`, 10, 15 * 60);
  if (!rlIp.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rlIp.resetInSec) } },
    );
  }

  const { tempToken, backupCode } = await req.json();
  if (!tempToken || !backupCode) {
    return NextResponse.json({ message: 'tempToken e backupCode obrigatórios' }, { status: 400 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return NextResponse.json({ message: 'Configuração inválida' }, { status: 500 });
  const key = new TextEncoder().encode(secret);

  let payload: { sub: string; type: string; role: string };
  try {
    const result = await jwtVerify(tempToken, key);
    payload = result.payload as typeof payload;
  } catch {
    return NextResponse.json({ message: 'Token temporário inválido' }, { status: 401 });
  }

  if (payload.type !== 'TEMP_2FA') {
    return NextResponse.json({ message: 'Token inválido' }, { status: 401 });
  }

  // Rate limit por userId — 5 tentativas a cada 15 min (bloqueia rotação de IP)
  const rlUser = await checkRateLimit(`2fa:backup:user:${payload.sub}`, 5, 15 * 60);
  if (!rlUser.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas para esta conta. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rlUser.resetInSec) } },
    );
  }

  const isContador = payload.role === 'ACCOUNTANT' || payload.role === 'ADMIN';

  // Transação com row lock para serializar tentativas concorrentes com o mesmo código
  let codigoValido = false;
  try {
    await prisma.$transaction(async (tx) => {
      if (isContador) {
        await tx.$executeRaw`SELECT id FROM usuario_contador WHERE id = ${payload.sub}::uuid FOR UPDATE`;
      } else {
        await tx.$executeRaw`SELECT id FROM usuario_cliente WHERE id = ${payload.sub}::uuid FOR UPDATE`;
      }

      const fresh = isContador
        ? await tx.usuarioContador.findUnique({ where: { id: payload.sub }, select: { twoFactorBackupCodes: true } })
        : await tx.usuarioCliente.findUnique({ where: { id: payload.sub }, select: { twoFactorBackupCodes: true } });

      if (!fresh) throw new Error('USER_NOT_FOUND');

      const idx = await verifyBackupCode(backupCode.toUpperCase(), fresh.twoFactorBackupCodes);
      if (idx === -1) throw new Error('INVALID_CODE');

      const newCodes = [...fresh.twoFactorBackupCodes];
      newCodes.splice(idx, 1);

      if (isContador) {
        await tx.usuarioContador.update({ where: { id: payload.sub }, data: { twoFactorBackupCodes: newCodes } });
      } else {
        await tx.usuarioCliente.update({ where: { id: payload.sub }, data: { twoFactorBackupCodes: newCodes } });
      }

      codigoValido = true;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'USER_NOT_FOUND') {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }
    if (msg === 'INVALID_CODE') {
      return NextResponse.json({ message: 'Código de backup inválido' }, { status: 401 });
    }
    throw err;
  }

  if (!codigoValido) {
    return NextResponse.json({ message: 'Código de backup inválido' }, { status: 401 });
  }

  const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h';
  const token = await new SignJWT({ sub: payload.sub, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(key);

  const rememberToken = await new SignJWT({ sub: payload.sub, type: '2FA_REMEMBER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(key);

  const response = NextResponse.json({ token });
  response.cookies.set(`fiscohub_2fa_remember_${payload.sub}`, rememberToken, {
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'strict',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
