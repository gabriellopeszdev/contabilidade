import { NextRequest, NextResponse } from 'next/server';
import { withAuth }  from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }    from '../../../../../src/infrastructure/di/Container';
import { logger }    from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/admin/webhook-logs — Lista eventos de webhook recebidos (idempotency log)
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url   = new URL(req.url);
    const page  = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));

    const [logs, total] = await Promise.all([
      prisma.webhookEventLog.findMany({
        orderBy: { processedAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.webhookEventLog.count(),
    ]);

    return NextResponse.json({
      logs: logs.map((l) => ({
        id:          l.id,
        eventKey:    l.eventKey,
        processedAt: l.processedAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('[GET /admin/webhook-logs]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
