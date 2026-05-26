import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/infrastructure/di/Container';
import { verifyToken } from '@/lib/totp';

export async function POST(req: NextRequest) {
  const { tempToken, totpToken } = await req.json();

  if (!tempToken || !totpToken) {
    return NextResponse.json({ message: 'tempToken e totpToken obrigatórios' }, { status: 400 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) return NextResponse.json({ message: 'Configuração inválida' }, { status: 500 });
  const key = new TextEncoder().encode(secret);

  let payload: { sub: string; type: string; role: string };
  try {
    const result = await jwtVerify(tempToken, key);
    payload = result.payload as typeof payload;
  } catch {
    return NextResponse.json({ message: 'Token temporário inválido ou expirado' }, { status: 401 });
  }

  if (payload.type !== 'TEMP_2FA') {
    return NextResponse.json({ message: 'Token inválido' }, { status: 401 });
  }

  const isContador = payload.role === 'ACCOUNTANT' || payload.role === 'ADMIN';
  const usuario = isContador
    ? await prisma.usuarioContador.findUnique({ where: { id: payload.sub }, select: { twoFactorSecret: true, isActive: true } })
    : await prisma.usuarioCliente.findUnique({ where: { id: payload.sub }, select: { twoFactorSecret: true, isActive: true } });

  if (!usuario?.isActive || !usuario.twoFactorSecret) {
    return NextResponse.json({ message: 'Usuário inativo ou 2FA não configurado' }, { status: 401 });
  }

  const valid = verifyToken(totpToken, usuario.twoFactorSecret);
  if (!valid) return NextResponse.json({ message: 'Código 2FA inválido' }, { status: 401 });

  const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h';
  const token = await new SignJWT({ sub: payload.sub, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(key);

  return NextResponse.json({ token });
}
