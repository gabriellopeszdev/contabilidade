import { NextRequest, NextResponse } from 'next/server';
import { withAuth }  from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }    from '../../../../../src/infrastructure/di/Container';
import { logger }    from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/admin/clientes — Lista todos os clientes da plataforma
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url         = new URL(req.url);
    const page        = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10));
    const limit       = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
    const search      = url.searchParams.get('search')?.trim()       ?? undefined;
    const escritorioId = url.searchParams.get('escritorioId')?.trim() ?? undefined;

    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where.OR = [
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cnpj:  { contains: search } },
      ];
    }

    if (escritorioId) {
      where.contadoresRel = { some: { contadorId: escritorioId } };
    }

    const [clientes, total] = await Promise.all([
      prisma.usuarioCliente.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          contadoresRel: {
            include: { contador: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.usuarioCliente.count({ where }),
    ]);

    return NextResponse.json({
      clientes: clientes.map((c) => ({
        id:          c.id,
        name:        c.name,
        email:       c.email,
        cnpj:        c.cnpj,
        isActive:    c.isActive,
        escritorios: c.contadoresRel.map((r) => ({ id: r.contador.id, name: r.contador.name })),
        createdAt:   c.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('[GET /admin/clientes]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
