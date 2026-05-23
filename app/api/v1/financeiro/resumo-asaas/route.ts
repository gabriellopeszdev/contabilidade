import { NextResponse } from 'next/server';
import { withAuth }     from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }       from '../../../../../src/infrastructure/di/Container';
import { AsaasService } from '../../../../../src/infrastructure/asaas/AsaasService';
import { logger }       from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/financeiro/resumo-asaas — Estatísticas e saldo da conta Asaas do contador
export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    let contadorId = auth.sub;
    if (auth.role === 'EMPLOYEE' && auth.vinculo === 'ESCRITORIO' && auth.superiorId) {
      contadorId = auth.superiorId;
    }

    const config = await prisma.configuracaoEscritorio.findUnique({
      where:  { contadorId },
      select: { asaasApiKey: true },
    });

    if (!config?.asaasApiKey) {
      return NextResponse.json({ configurado: false, dados: null });
    }

    const svc = new AsaasService(config.asaasApiKey);
    const [dados, canceladoDB] = await Promise.all([
      svc.buscarEstatisticas(),
      prisma.boletoHonorario.aggregate({
        _count: { id: true },
        _sum:   { valor: true },
        where:  { escritorioId: contadorId, status: 'CANCELADO' },
      }),
    ]);

    // CANCELLED não existe no endpoint /finance/payment/statistics do Asaas;
    // contamos localmente.
    dados.cancelado = {
      quantidade: canceladoDB._count.id,
      valor:      Number(canceladoDB._sum.valor ?? 0),
    };

    return NextResponse.json({ configurado: true, dados });
  } catch (err) {
    logger.error('[GET /financeiro/resumo-asaas]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
