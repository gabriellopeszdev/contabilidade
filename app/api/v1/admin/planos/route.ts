import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/admin/planos — Lista todos os planos SaaS
// =============================================================================

export const GET = withAuth(async () => {
  const planos = await prisma.planoSaaS.findMany({
    orderBy: { preco: 'asc' },
    include: {
      _count: {
        select: {
          assinaturas: { where: { status: { in: ['ATIVO', 'TRIAL'] } } },
        },
      },
    },
  });

  return NextResponse.json(
    planos.map((p) => ({
      id:               p.id,
      nome:             p.nome,
      descricao:        p.descricao,
      preco:            Number(p.preco),
      limiteClientes:   p.limiteClientes,
      limiteDocumentos: p.limiteDocumentos,
      features:         p.features,
      isActive:         p.isActive,
      assinantes:       p._count.assinaturas,
      createdAt:        p.createdAt,
    })),
  );
}, ['ADMIN']);

// =============================================================================
// POST /api/v1/admin/planos — Cria um novo plano SaaS
// =============================================================================

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json() as {
    nome:             string;
    descricao?:       string;
    preco:            number;
    limiteClientes:   number;
    limiteDocumentos: number;
    features:         string[];
  };

  if (
    !body.nome?.trim() ||
    body.preco == null ||
    body.limiteClientes == null ||
    body.limiteDocumentos == null
  ) {
    return NextResponse.json(
      { message: 'Campos obrigatórios: nome, preco, limiteClientes, limiteDocumentos.' },
      { status: 400 },
    );
  }

  const plano = await prisma.planoSaaS.create({
    data: {
      nome:             body.nome.trim(),
      descricao:        body.descricao?.trim() || null,
      preco:            body.preco,
      limiteClientes:   body.limiteClientes,
      limiteDocumentos: body.limiteDocumentos,
      features:         body.features ?? [],
    },
  });

  return NextResponse.json({ id: plano.id }, { status: 201 });
}, ['ADMIN']);
