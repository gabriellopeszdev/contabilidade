import { NextResponse } from 'next/server';
import { withAuth } from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../src/infrastructure/di/Container';
import { logger } from '../../../../src/utils/logger';
import {
  prazosIbsCbs,
  regimeAplicaIbsCbs,
  statusEfetivoIbsCbs,
  type StatusIbsCbs,
} from '../../../../src/utils/ibsCbs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const vinculos = await prisma.contadorCliente.findMany({
      where: { contadorId, cliente: { deletedAt: null } },
      select: {
        cliente: {
          select: {
            id:              true,
            name:            true,
            cnpj:            true,
            regimeTributario: true,
            ibsCbsStatus:    true,
            ibsCbsDecididoEm: true,
            ibsCbsObservacao: true,
          },
        },
      },
      orderBy: { cliente: { name: 'asc' } },
    });

    const clientes = vinculos.map((v) => {
      const c = v.cliente;
      const status = statusEfetivoIbsCbs(c.regimeTributario, c.ibsCbsStatus as StatusIbsCbs);
      const aplicavel = regimeAplicaIbsCbs(c.regimeTributario);
      return {
        id:               c.id,
        nome:             c.name,
        cnpj:             c.cnpj,
        regimeTributario: c.regimeTributario,
        aplicavel,
        status,
        decididoEm:       c.ibsCbsDecididoEm?.toISOString() ?? null,
        observacao:       c.ibsCbsObservacao,
      };
    });

    const aplicaveis = clientes.filter((c) => c.aplicavel);
    const resumo = {
      totalAplicaveis: aplicaveis.length,
      pendentes:  aplicaveis.filter((c) => c.status === 'PENDENTE').length,
      dentroDas:  aplicaveis.filter((c) => c.status === 'DENTRO_DAS').length,
      foraDas:    aplicaveis.filter((c) => c.status === 'FORA_DAS').length,
      naoSeAplica: clientes.filter((c) => c.status === 'NAO_SE_APLICA').length,
      total:      clientes.length,
    };

    const prazos = prazosIbsCbs();

    return NextResponse.json({
      ...prazos,
      resumo,
      clientes,
    });
  } catch (err) {
    logger.error('[GET /reforma-ibs-cbs] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
