import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { verifyToken, generateBackupCodes } from '@/lib/totp';

export const POST = withAuth(async (req, _ctx, auth) => {
  const { token } = await req.json();
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ message: 'Token obrigatório' }, { status: 400 });
  }

  const userId = auth.sub;
  const isContador = auth.role === 'ACCOUNTANT' || auth.role === 'ADMIN';

  const usuario = isContador
    ? await prisma.usuarioContador.findUnique({ where: { id: userId }, select: { twoFactorSecret: true, twoFactorEnabled: true } })
    : await prisma.usuarioCliente.findUnique({ where: { id: userId }, select: { twoFactorSecret: true, twoFactorEnabled: true } });

  if (!usuario?.twoFactorSecret) {
    return NextResponse.json({ message: 'Execute o setup primeiro' }, { status: 400 });
  }
  if (usuario.twoFactorEnabled) {
    return NextResponse.json({ message: '2FA já está ativo' }, { status: 400 });
  }

  const valid = verifyToken(token, usuario.twoFactorSecret);
  if (!valid) return NextResponse.json({ message: 'Token inválido' }, { status: 400 });

  const { plain, hashed } = await generateBackupCodes();

  if (isContador) {
    await prisma.usuarioContador.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashed },
    });
  } else {
    await prisma.usuarioCliente.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorBackupCodes: hashed },
    });
  }

  return NextResponse.json({ backupCodes: plain });
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);
