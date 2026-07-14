import { NextRequest, NextResponse } from 'next/server';
import { queueProducer }  from '../../../../../../../src/infrastructure/di/Container';
import { withAuth }       from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/admin/queues/[jobId]/retry
//
// Move um job com falha de volta para a fila (retry manual).
// Acesso exclusivo ADMIN.
// =============================================================================

export const POST = withAuth(async (_req: NextRequest, ctx: RouteContext) => {
  const { jobId } = await ctx.params;

  const job = await queueProducer.getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 });
  }

  const state = await job.getState();
  if (state !== 'failed') {
    return NextResponse.json({ error: `Job está no estado "${state}", não "failed"` }, { status: 400 });
  }

  await job.retry('failed');

  return NextResponse.json({ ok: true, jobId });
}, ['ADMIN']);
