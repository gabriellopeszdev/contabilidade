import { NextResponse }  from 'next/server';
import { withAuth }      from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }        from '../../../../../src/infrastructure/di/Container';
import { logger }        from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/admin/stats — Métricas agregadas da plataforma
export const GET = withAuth(async () => {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [
      totalEscritorios,
      escritoriosAtivos,
      comAsaas,
      totalClientes,
      emAberto,
      pagosMes,
      assinaturasAtivas,
      totalWebhooks,
    ] = await Promise.all([
      prisma.usuarioContador.count({ where: { deletedAt: null, isAdmin: false } }),
      prisma.usuarioContador.count({ where: { deletedAt: null, isAdmin: false, isActive: true } }),
      prisma.configuracaoEscritorio.count({ where: { asaasApiKey: { not: null } } }),
      prisma.usuarioCliente.count({ where: { deletedAt: null } }),

      prisma.boletoHonorario.aggregate({
        _count: { id: true },
        _sum:   { valor: true },
        where:  { status: { in: ['PENDENTE', 'VENCIDO'] } },
      }),

      prisma.boletoHonorario.aggregate({
        _count: { id: true },
        _sum:   { valor: true },
        where:  { status: 'PAGO', createdAt: { gte: inicioMes } },
      }),

      prisma.assinaturaHonorario.count({
        where: { asaasId: { not: null }, asaasStatus: { not: 'INACTIVE' } },
      }),

      prisma.webhookEventLog.count(),
    ]);

    return NextResponse.json({
      totalEscritorios,
      escritoriosAtivos,
      escritoriosBloqueados: totalEscritorios - escritoriosAtivos,
      comAsaas,
      totalClientes,
      boletosEmAberto:   emAberto._count.id,
      valorEmAberto:     Number(emAberto._sum.valor ?? 0),
      boletosPagosMes:   pagosMes._count.id,
      valorPagoMes:      Number(pagosMes._sum.valor ?? 0),
      assinaturasAtivas,
      totalWebhooks,
    });
  } catch (err) {
    logger.error('[GET /admin/stats]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
