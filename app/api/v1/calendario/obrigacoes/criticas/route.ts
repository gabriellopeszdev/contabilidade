import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const diasParam = parseInt(req.nextUrl.searchParams.get('dias') ?? '7', 10);
    const dias = Number.isFinite(diasParam) && diasParam >= 1 && diasParam <= 60 ? diasParam : 7;

    const hoje  = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + dias);

    const instancias = await prisma.instanciaObrigacao.findMany({
      where: {
        contadorId,
        concluida:  false,
        vencimento: { gte: hoje, lte: limite },
      },
      orderBy: { vencimento: 'asc' },
      select: {
        id:            true,
        mesReferencia: true,
        vencimento:    true,
        concluida:     true,
        obrigacao: {
          select: {
            id:    true,
            nome:  true,
            cor:   true,
            descricao: true,
          },
        },
      },
    });

    const hoje2 = Date.now();
    const resultado = instancias.map((inst) => {
      const diasRestantes = Math.ceil((inst.vencimento.getTime() - hoje2) / 86_400_000);
      return {
        id:             inst.id,
        mesReferencia:  inst.mesReferencia,
        vencimento:     inst.vencimento.toISOString().split('T')[0],
        diasRestantes,
        urgente:        diasRestantes <= 3,
        obrigacaoId:    inst.obrigacao.id,
        nome:           inst.obrigacao.nome,
        descricao:      inst.obrigacao.descricao ?? null,
        cor:            inst.obrigacao.cor,
      };
    });

    return NextResponse.json({ total: resultado.length, dias, obrigacoes: resultado });
  } catch (err) {
    logger.error('[GET /calendario/obrigacoes/criticas] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
