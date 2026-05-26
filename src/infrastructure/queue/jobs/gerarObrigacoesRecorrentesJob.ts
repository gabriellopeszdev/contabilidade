import { prisma } from '@/infrastructure/di/Container';

const MESES_POR_RECORRENCIA: Record<string, number[]> = {
  MENSAL:     [1,2,3,4,5,6,7,8,9,10,11,12],
  BIMESTRAL:  [1,3,5,7,9,11],
  TRIMESTRAL: [1,4,7,10],
  SEMESTRAL:  [1,7],
  ANUAL:      [1],
};

export async function gerarObrigacoesRecorrentesJob(): Promise<void> {
  const agora = new Date();
  const proximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const ano = proximoMes.getFullYear();
  const mes = proximoMes.getMonth() + 1; // 1-12
  const mesReferencia = `${ano}-${String(mes).padStart(2, '0')}`;

  const obrigacoes = await prisma.obrigacaoFiscal.findMany({
    where: { ativo: true, recorrencia: { not: null } },
  });

  for (const obrigacao of obrigacoes) {
    if (!obrigacao.recorrencia) continue;

    const mesesValidos = obrigacao.mesesAplicacao.length > 0
      ? obrigacao.mesesAplicacao
      : MESES_POR_RECORRENCIA[obrigacao.recorrencia] ?? [];

    if (!mesesValidos.includes(mes)) continue;

    // diaVencimento from ObrigacaoFiscal schema (line 483)
    const diaVenc = Math.min(obrigacao.diaVencimento, new Date(ano, mes, 0).getDate());
    const vencimento = new Date(ano, mes - 1, diaVenc);

    await prisma.instanciaObrigacao.upsert({
      where: { obrigacaoId_mesReferencia: { obrigacaoId: obrigacao.id, mesReferencia } },
      create: {
        obrigacaoId: obrigacao.id,
        contadorId:  obrigacao.contadorId,
        mesReferencia,
        vencimento,
      },
      update: {},
    });
  }
}
