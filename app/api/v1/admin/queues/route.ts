import { NextRequest, NextResponse } from 'next/server';
import { queueProducer }  from '../../../../../src/infrastructure/di/Container';
import { withAuth }       from '../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/admin/queues
//
// Retorna contagem de jobs por status + listas de jobs recentes.
// Acesso exclusivo ADMIN.
// =============================================================================

export const GET = withAuth(async (_req: NextRequest, _ctx: RouteContext) => {
  const [counts, failedJobs, activeJobs, completedJobs, delayedJobs] = await Promise.all([
    queueProducer.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed', 'paused'),
    queueProducer.getFailed(0, 24),
    queueProducer.getActive(),
    queueProducer.getCompleted(0, 14),
    queueProducer.getDelayed(0, 9),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapJob = (job: any) => ({
    id:           job.id,
    name:         job.name,
    tipo:         (job.data as { tipo?: string })?.tipo ?? job.name,
    failedReason: job.failedReason  ?? null,
    stacktrace:   Array.isArray(job.stacktrace) ? (job.stacktrace[0] ?? null) : null,
    finishedOn:   job.finishedOn    ?? null,
    processedOn:  job.processedOn   ?? null,
    timestamp:    job.timestamp     ?? null,
    attemptsMade: job.attemptsMade  ?? 0,
    duration:
      typeof job.finishedOn === 'number' && typeof job.processedOn === 'number'
        ? job.finishedOn - job.processedOn
        : null,
  });

  return NextResponse.json({
    fila:      queueProducer.name,
    counts,
    failed:    failedJobs.map(mapJob),
    active:    activeJobs.map(mapJob),
    completed: completedJobs.map(mapJob),
    delayed:   delayedJobs.map(mapJob),
  });
}, ['ADMIN']);
