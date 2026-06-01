import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { generateSecret, generateOtpAuthUrl, encryptSecret } from '@/lib/totp';
import QRCode from 'qrcode';

export const GET = withAuth(async (req, ctx, auth) => {
  const userId = auth.sub;
  const role = auth.role;

  const isContador = role === 'ACCOUNTANT' || role === 'ADMIN';

  const usuario = isContador
    ? await prisma.usuarioContador.findUnique({ where: { id: userId }, select: { email: true, twoFactorEnabled: true } })
    : await prisma.usuarioCliente.findUnique({ where: { id: userId }, select: { email: true, twoFactorEnabled: true } });

  if (!usuario) return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
  if (usuario.twoFactorEnabled) return NextResponse.json({ message: '2FA já está ativado' }, { status: 400 });

  const secret = generateSecret();
  const otpAuthUrl = generateOtpAuthUrl(usuario.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
  const encryptedSecret = encryptSecret(secret);

  if (isContador) {
    await prisma.usuarioContador.update({ where: { id: userId }, data: { twoFactorSecret: encryptedSecret } });
  } else {
    await prisma.usuarioCliente.update({ where: { id: userId }, data: { twoFactorSecret: encryptedSecret } });
  }

  return NextResponse.json({ qrCode: qrCodeDataUrl });
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);
