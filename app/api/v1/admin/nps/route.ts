import { NextRequest, NextResponse } from 'next/server';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/admin/nps
// Query: page, limit, userType, minScore, maxScore
// Response: { respostas, total, page, totalPages, media, distribuicao }

export const GET = withAuth(async (req: NextRequest, _ctx: RouteContext) => {
  const url      = new URL(req.url);
  const page     = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1', 10));
  const limit    = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const userType = url.searchParams.get('userType') ?? '';
  const minScore = url.searchParams.get('minScore') ? parseInt(url.searchParams.get('minScore')!, 10) : undefined;
  const maxScore = url.searchParams.get('maxScore') ? parseInt(url.searchParams.get('maxScore')!, 10) : undefined;

  const where: Record<string, unknown> = {};
  if (userType) where.userType = userType;
  if (minScore !== undefined || maxScore !== undefined) {
    where.score = {};
    if (minScore !== undefined) (where.score as Record<string, number>).gte = minScore;
    if (maxScore !== undefined) (where.score as Record<string, number>).lte = maxScore;
  }

  const [respostas, total, agregado] = await Promise.all([
    prisma.npsResponse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.npsResponse.count({ where }),
    prisma.npsResponse.aggregate({
      _avg: { score: true },
      _count: { score: true },
    }),
  ]);

  // Distribuição por score (0-10)
  const distribuicaoRaw = await prisma.npsResponse.groupBy({
    by: ['score'],
    _count: { score: true },
  });
  const distribuicao: Record<number, number> = {};
  for (const row of distribuicaoRaw) {
    distribuicao[row.score] = row._count.score;
  }

  return NextResponse.json({
    respostas,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    media:      agregado._avg.score ? Math.round(agregado._avg.score * 10) / 10 : null,
    distribuicao,
  });
}, ['SUPER_ADMIN']);
