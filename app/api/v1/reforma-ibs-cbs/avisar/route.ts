import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, eventDispatcher } from '../../../../../src/infrastructure/di/Container';
import { NovoComunicadoEvent } from '../../../../../src/domain/events/NovoComunicadoEvent';
import { logger } from '../../../../../src/utils/logger';
import { prazosIbsCbs, regimeAplicaIbsCbs } from '../../../../../src/utils/ibsCbs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function br(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export const POST = withAuth(async (_req, _ctx, auth) => {
  try {
    const prazos = prazosIbsCbs();
    const titulo = `Decisão IBS/CBS do Simples Nacional — prazo até ${br(prazos.prazoFim)}`;
    const conteudo = `<p>Entre <strong>${br(prazos.prazoInicio)} e ${br(prazos.prazoFim)}</strong> sua empresa no Simples Nacional precisa decidir se recolhe IBS e CBS <strong>dentro do DAS</strong> ou pelo regime regular <strong>fora do DAS</strong>.</p>
<p>A escolha vale de <strong>${br(prazos.vigencia)}</strong> a <strong>${br(prazos.vigenciaFim)}</strong> (${prazos.competencia}) e só pode ser revertida até <strong>${br(prazos.reversaoAte)}</strong>.</p>
<p>Fale com o escritório para registrar a decisão. Sem manifestação no prazo, o enquadramento padrão da Receita será aplicado.</p>`;

    const vinculos = await prisma.contadorCliente.findMany({
      where: { contadorId: auth.sub, cliente: { deletedAt: null } },
      select: {
        clienteId: true,
        cliente: { select: { regimeTributario: true, ibsCbsStatus: true } },
      },
    });

    const clienteIds = vinculos
      .filter((v) =>
        regimeAplicaIbsCbs(v.cliente.regimeTributario) && v.cliente.ibsCbsStatus === 'PENDENTE',
      )
      .map((v) => v.clienteId);

    if (clienteIds.length === 0) {
      return NextResponse.json({ message: 'Nenhum cliente pendente para avisar.', totalDestinatarios: 0 });
    }

    const contador = await prisma.usuarioContador.findUnique({
      where:  { id: auth.sub },
      select: { name: true },
    });

    const comunicado = await prisma.$transaction(async (tx) => {
      const c = await tx.comunicado.create({
        data: {
          contadorId:       auth.sub,
          titulo,
          conteudo,
          exigeConfirmacao: true,
          targeting:        'SELECIONADOS',
        },
      });
      await tx.comunicadoDestinatario.createMany({
        data: clienteIds.map((clienteId) => ({ comunicadoId: c.id, clienteId })),
        skipDuplicates: true,
      });
      return c;
    });

    void eventDispatcher.dispatch(
      new NovoComunicadoEvent(
        comunicado.id,
        titulo,
        contador?.name ?? 'Seu contador',
        clienteIds,
      ),
    );

    return NextResponse.json(
      { id: comunicado.id, totalDestinatarios: clienteIds.length },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[POST /reforma-ibs-cbs/avisar] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
