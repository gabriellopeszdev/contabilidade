import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

export const GET = withAuth(async (req, ctx, auth) => {
  const contador = await prisma.usuarioContador.findUnique({
    where: { id: auth.sub },
    select: { primeiroLoginEm: true },
  });

  if (!contador?.primeiroLoginEm) return NextResponse.json({ exibir: false });

  const diasDesdeLogin = (Date.now() - contador.primeiroLoginEm.getTime()) / (1000 * 60 * 60 * 24);
  if (diasDesdeLogin < 7) return NextResponse.json({ exibir: false });

  const ultimaResposta = await prisma.npsResponse.findFirst({
    where: { userId: auth.sub },
    orderBy: { createdAt: 'desc' },
  });

  if (ultimaResposta) {
    const diasDesdeResposta = (Date.now() - ultimaResposta.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diasDesdeResposta < 90) return NextResponse.json({ exibir: false });
  }

  return NextResponse.json({ exibir: true });
}, ['ACCOUNTANT', 'CLIENT']);

export const POST = withAuth(async (req, ctx, auth) => {
  const body = await req.json() as { score?: number; comentario?: string };
  const { score, comentario } = body;

  if (typeof score !== 'number' || score < 0 || score > 10) {
    return NextResponse.json({ message: 'Score deve ser entre 0 e 10' }, { status: 400 });
  }

  await prisma.npsResponse.create({
    data: {
      userId:    auth.sub,
      userType:  auth.role === 'ACCOUNTANT' ? 'CONTADOR' : 'CLIENTE',
      score,
      comentario: comentario?.slice(0, 1000),
    },
  });

  return NextResponse.json({ message: 'Obrigado pelo feedback!' });
}, ['ACCOUNTANT', 'CLIENT']);
