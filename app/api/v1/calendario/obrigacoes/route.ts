import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/calendario/obrigacoes — Lista obrigações fiscais do escritório
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
    const obrigacoes = await prisma.obrigacaoFiscal.findMany({
      where: { contadorId, ativo: true },
      orderBy: { diaVencimento: 'asc' },
    });

    return NextResponse.json({ obrigacoes });
  } catch (err) {
    logger.error('[GET /calendario/obrigacoes] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);

// =============================================================================
// POST /api/v1/calendario/obrigacoes — Cria nova obrigação fiscal
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  try {
    const body = await req.json();
    const { nome, descricao, diaVencimento, cor } = body as {
      nome: string;
      descricao?: string;
      diaVencimento: number;
      cor?: string;
    };

    if (!nome || nome.length < 2 || nome.length > 100) {
      return NextResponse.json({ message: 'Nome inválido (2-100 caracteres).' }, { status: 400 });
    }

    if (!diaVencimento || diaVencimento < 1 || diaVencimento > 31) {
      return NextResponse.json({ message: 'Dia de vencimento inválido (1-31).' }, { status: 400 });
    }

    const obrigacao = await prisma.obrigacaoFiscal.create({
      data: {
        contadorId: auth.sub,
        nome,
        descricao: descricao ?? null,
        diaVencimento,
        cor: cor ?? '#3b82f6',
      },
    });

    return NextResponse.json({ obrigacao }, { status: 201 });
  } catch (err) {
    logger.error('[POST /calendario/obrigacoes] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
