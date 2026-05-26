import { NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';
import bcrypt from 'bcryptjs';

export const POST = withAuth(async (req, _ctx, auth) => {
  const { senha } = await req.json();
  if (!senha) return NextResponse.json({ message: 'Senha obrigatória' }, { status: 400 });

  const userId = auth.sub;
  const isContador = auth.role === 'ACCOUNTANT' || auth.role === 'ADMIN';

  const usuario = isContador
    ? await prisma.usuarioContador.findUnique({ where: { id: userId }, select: { passwordHash: true } })
    : await prisma.usuarioCliente.findUnique({ where: { id: userId }, select: { passwordHash: true } });

  if (!usuario?.passwordHash) return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });

  const ok = await bcrypt.compare(senha, usuario.passwordHash);
  if (!ok) return NextResponse.json({ message: 'Senha incorreta' }, { status: 401 });

  if (isContador) {
    await prisma.usuarioContador.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });
  } else {
    await prisma.usuarioCliente.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });
  }

  return NextResponse.json({ message: '2FA desativado com sucesso' });
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);
