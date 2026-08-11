import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../src/infrastructure/di/Container';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, _ctx: RouteContext, auth) => {
  const body = await req.json().catch(() => null) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;

  const endpoint = body?.endpoint?.trim();
  const p256dh = body?.keys?.p256dh?.trim();
  const authKey = body?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ message: 'Subscription inválida.' }, { status: 400 });
  }

  await prisma.inscricaoPush.upsert({
    where:  { endpoint },
    create: {
      userId:    auth.sub,
      endpoint,
      p256dh,
      auth:      authKey,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    },
    update: {
      userId:    auth.sub,
      p256dh,
      auth:      authKey,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (req: NextRequest, _ctx: RouteContext, auth) => {
  const body = await req.json().catch(() => null) as { endpoint?: string } | null;
  if (body?.endpoint) {
    await prisma.inscricaoPush.deleteMany({
      where: { userId: auth.sub, endpoint: body.endpoint },
    });
  }
  return NextResponse.json({ ok: true });
});
