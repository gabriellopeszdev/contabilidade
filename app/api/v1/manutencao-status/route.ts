import { NextResponse } from 'next/server';
import { prisma } from '../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await prisma.configuracaoSistema.findUnique({
      where:  { id: 'system' },
      select: { manutencaoAtiva: true },
    });
    return NextResponse.json({ ativa: config?.manutencaoAtiva ?? false });
  } catch {
    return NextResponse.json({ ativa: false });
  }
}
