import { NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const planos = await prisma.planoSaaS.findMany({
    where: { isActive: true },
    select: {
      id:               true,
      nome:             true,
      descricao:        true,
      preco:            true,
      limiteClientes:   true,
      limiteDocumentos: true,
      features:         true,
    },
    orderBy: { preco: 'asc' },
  });

  return NextResponse.json({ planos });
}
