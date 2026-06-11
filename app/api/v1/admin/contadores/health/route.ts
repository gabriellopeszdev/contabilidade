import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, _ctx) => {
  try {
    const contadores = await prisma.usuarioContador.findMany({
      where:   { deletedAt: null, isAdmin: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id:             true,
        name:           true,
        email:          true,
        primeiroLoginEm: true,
        _count: { select: { clientesRel: true } },
        configuracao: { select: { nomeEscritorio: true } },
        assinaturaSaaS: {
          select: {
            status: true,
            plano: { select: { nome: true } },
          },
        },
      },
    });

    const agora = Date.now();

    const items = contadores
      .map((c) => {
        const diasInativo = c.primeiroLoginEm
          ? Math.floor((agora - c.primeiroLoginEm.getTime()) / 86_400_000)
          : null;

        return {
          id:               c.id,
          name:             c.name,
          email:            c.email,
          nomeEscritorio:   c.configuracao?.nomeEscritorio ?? null,
          planoNome:        c.assinaturaSaaS?.plano.nome ?? null,
          statusAssinatura: c.assinaturaSaaS?.status ?? null,
          totalClientes:    c._count.clientesRel,
          ultimoLogin:      c.primeiroLoginEm?.toISOString() ?? null,
          diasInativo,
        };
      })
      .sort((a, b) => {
        if (a.diasInativo === null && b.diasInativo === null) return 0;
        if (a.diasInativo === null) return 1;
        if (b.diasInativo === null) return -1;
        return b.diasInativo - a.diasInativo;
      });

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    logger.error('[GET /admin/contadores/health] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ADMIN']);
