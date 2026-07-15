import { NextResponse } from 'next/server';
import { withAuth }       from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }         from '../../../../../src/infrastructure/di/Container';
import { redisPublisher } from '../../../../../src/infrastructure/di/Container';
import { enviarAvisoAdmin } from '../../../../../src/utils/enviarAvisoAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req, _ctx, _auth) => {
  let titulo:   string;
  let mensagem: string;

  try {
    const body = await req.json() as { titulo?: unknown; mensagem?: unknown };
    titulo   = typeof body.titulo   === 'string' ? body.titulo.trim()   : '';
    mensagem = typeof body.mensagem === 'string' ? body.mensagem.trim() : '';
  } catch {
    return NextResponse.json({ message: 'Body inválido.' }, { status: 400 });
  }

  if (!titulo)   return NextResponse.json({ message: 'Título é obrigatório.' },   { status: 400 });
  if (!mensagem) return NextResponse.json({ message: 'Mensagem é obrigatória.' }, { status: 400 });
  if (titulo.length   > 200) return NextResponse.json({ message: 'Título muito longo (máx 200).' },   { status: 400 });
  if (mensagem.length > 500) return NextResponse.json({ message: 'Mensagem muito longa (máx 500).' }, { status: 400 });

  const enviados = await enviarAvisoAdmin(titulo, mensagem, prisma, redisPublisher);

  return NextResponse.json({ ok: true, enviados });
}, ['ADMIN']);
