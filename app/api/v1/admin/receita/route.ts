import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, _ctx, _auth) => {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

  // 1. MRR: soma valorMensal de assinaturas ATIVO
  const mrrResult = await prisma.assinaturaSaaS.aggregate({
    where: { status: 'ATIVO' },
    _sum: { valorMensal: true },
  });
  const mrr = Number(mrrResult._sum.valorMensal ?? 0);

  // 2. Distribuição por plano (assinaturas ATIVO)
  const porPlanoRaw = await prisma.assinaturaSaaS.groupBy({
    by: ['planoId'],
    where: { status: 'ATIVO' },
    _count: { id: true },
  });
  const planos = await prisma.planoSaaS.findMany({
    where: { id: { in: porPlanoRaw.map(p => p.planoId) } },
    select: { id: true, nome: true },
  });
  const planoMap = Object.fromEntries(planos.map(p => [p.id, p.nome]));
  const porPlano = porPlanoRaw.map(p => ({
    planoId:   p.planoId,
    planoNome: planoMap[p.planoId] ?? 'Desconhecido',
    total:     p._count.id,
  }));

  // 3. Contagem por status
  const todosStatus = await prisma.assinaturaSaaS.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  const porStatus: Record<string, number> = {};
  for (const s of todosStatus) {
    porStatus[s.status] = s._count.id;
  }

  // 4. Taxa de conversão trial→pago (30, 60, 90 dias)
  const conversaoTrial = await Promise.all([30, 60, 90].map(async (dias) => {
    const inicio = new Date(agora.getTime() - dias * 86400000);
    const [triaisIniciados, convertidos] = await Promise.all([
      prisma.assinaturaSaaS.count({ where: { dataInicio: { gte: inicio } } }),
      prisma.assinaturaSaaS.count({ where: { dataInicio: { gte: inicio }, status: 'ATIVO' } }),
    ]);
    return {
      periodo: dias,
      triaisIniciados,
      convertidos,
      taxa: triaisIniciados > 0 ? Math.round((convertidos / triaisIniciados) * 100) : 0,
    };
  }));

  // 5. Churn do mês: cancelados este mês vs ativas no início do mês
  // Usar updatedAt como proxy de quando o status mudou para CANCELADO
  const canceladosNesteMes = await prisma.assinaturaSaaS.count({
    where: { status: 'CANCELADO', updatedAt: { gte: inicioMes } },
  });
  const ativasNoInicio = await prisma.assinaturaSaaS.count({
    where: { status: { in: ['ATIVO', 'CANCELADO'] }, dataInicio: { lt: inicioMes } },
  });
  const churnMes = {
    canceladosNesteMes,
    ativasNoInicio,
    taxa: ativasNoInicio > 0 ? Math.round((canceladosNesteMes / ativasNoInicio) * 100) : 0,
  };

  // 6. Próximos vencimentos (7 dias)
  const em7Dias = new Date(agora.getTime() + 7 * 86400000);
  const proximosVencimentos = await prisma.assinaturaSaaS.findMany({
    where: {
      status: { in: ['ATIVO', 'TRIAL'] },
      dataRenovacao: { gte: agora, lte: em7Dias },
    },
    select: {
      id: true,
      dataRenovacao: true,
      valorMensal: true,
      escritorio: { select: { name: true } },
    },
    orderBy: { dataRenovacao: 'asc' },
  });

  // 7. Receita dos últimos 6 meses (CobrancaSaaS com status que indique pago)
  // Gerar lista dos últimos 6 meses no formato "YYYY-MM"
  const ultimos6Meses: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    ultimos6Meses.push(mes);
  }
  const cobrancasPagas = await prisma.cobrancaSaaS.groupBy({
    by: ['mesReferencia'],
    where: {
      mesReferencia: { in: ultimos6Meses },
      status: { in: ['PAGO', 'RECEIVED', 'CONFIRMED'] },
    },
    _sum: { valor: true },
  });
  const cobrancasMap = Object.fromEntries(
    cobrancasPagas.map(c => [c.mesReferencia, Number(c._sum.valor ?? 0)])
  );
  const receitaMensal = ultimos6Meses.map(mes => ({
    mes,
    total: cobrancasMap[mes] ?? 0,
  }));

  return NextResponse.json({
    mrr,
    porPlano,
    porStatus,
    conversaoTrial,
    churnMes,
    proximosVencimentos: proximosVencimentos.map(v => ({
      id:             v.id,
      escritorioNome: v.escritorio.name,
      dataRenovacao:  v.dataRenovacao,
      valorMensal:    Number(v.valorMensal),
    })),
    receitaMensal,
  });
}, ['ADMIN']);
