import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/infrastructure/di/Container';
import { verifyBackupCode } from '@/lib/totp';

export async function POST(req: NextRequest) {
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

  const isContador = payload.role === 'ACCOUNTANT' || payload.role === 'ADMIN';
  const usuario = isContador
    ? await prisma.usuarioContador.findUnique({ where: { id: payload.sub }, select: { twoFactorBackupCodes: true } })
    : await prisma.usuarioCliente.findUnique({ where: { id: payload.sub }, select: { twoFactorBackupCodes: true } });

  if (!usuario) return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });

  const idx = await verifyBackupCode(backupCode.toUpperCase(), usuario.twoFactorBackupCodes);
  if (idx === -1) return NextResponse.json({ message: 'Código de backup inválido' }, { status: 401 });

  const newCodes = [...usuario.twoFactorBackupCodes];
  newCodes.splice(idx, 1);

  if (isContador) {
    await prisma.usuarioContador.update({ where: { id: payload.sub }, data: { twoFactorBackupCodes: newCodes } });
  } else {
    await prisma.usuarioCliente.update({ where: { id: payload.sub }, data: { twoFactorBackupCodes: newCodes } });
  }

  const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h';
  const token = await new SignJWT({ sub: payload.sub, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(key);

  return NextResponse.json({ token });
}
