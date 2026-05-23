import { NextRequest, NextResponse } from 'next/server';
import { withAuth }  from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }    from '../../../../../src/infrastructure/di/Container';
import { logger }    from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/admin/boletos — Lista todos os boletos de todos os escritórios
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url         = new URL(req.url);
    const page        = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10));
    const limit       = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
    const status      = url.searchParams.get('status')      ?? undefined;
    const escritorioId = url.searchParams.get('escritorioId') ?? undefined;
    const search      = url.searchParams.get('search')?.trim() ?? undefined;

    const where: Record<string, unknown> = {};
    if (status)       where.status       = status;
    if (escritorioId) where.escritorioId = escritorioId;
    if (search) {
      where.OR = [
        { cliente:    { name: { contains: search, mode: 'insensitive' } } },
        { cliente:    { cnpj: { contains: search } } },
        { escritorio: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [boletos, total] = await Promise.all([
      prisma.boletoHonorario.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          cliente:    { select: { name: true, cnpj: true } },
          escritorio: { select: { name: true } },
        },
      }),
      prisma.boletoHonorario.count({ where }),
    ]);

    return NextResponse.json({
      boletos: boletos.map((b) => ({
        id:              b.id,
        clienteNome:     b.cliente.name,
        clienteCnpj:     b.cliente.cnpj,
        escritorioNome:  b.escritorio.name,
        escritorioId:    b.escritorioId,
        valor:           Number(b.valor),
        status:          b.status,
        tipoPagamento:   b.tipoPagamento,
        mesReferencia:   b.mesReferencia,
        vencimento:      b.vencimento.toISOString(),
        asaasId:         b.asaasId,
        createdAt:       b.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('[GET /admin/boletos]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
