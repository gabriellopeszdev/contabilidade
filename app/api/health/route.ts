import { NextResponse } from 'next/server';
import { prisma, redisPublisher, minioClient } from '../../../src/infrastructure/di/Container';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}

export async function GET() {
  const [dbResult, redisResult, storageResult] = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, 3_000),
    withTimeout(redisPublisher.ping(), 3_000),
    withTimeout(
      minioClient.bucketExists(process.env.MINIO_BUCKET ?? 'documentos-contabeis'),
      3_000,
    ),
  ]);

  const checks = {
    database: dbResult.status    === 'fulfilled' ? 'ok' : 'error',
    redis:    redisResult.status === 'fulfilled' ? 'ok' : 'error',
    storage:  storageResult.status === 'fulfilled' ? 'ok' : 'error',
  };

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const mem   = process.memoryUsage();

  return NextResponse.json(
    {
      ok:      allOk,
      uptime:  Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? 'unknown',
      checks,
      memory:  { heapUsedMb: Math.round(mem.heapUsed / 1_048_576) },
    },
    { status: allOk ? 200 : 503 },
  );
}
