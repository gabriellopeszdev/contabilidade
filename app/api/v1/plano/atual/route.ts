import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { getPlanInfo } from '@/utils/planLimits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req, _ctx, auth) => {
  const plan = await getPlanInfo(auth.sub);
  return NextResponse.json({ plan });
}, ['ACCOUNTANT', 'EMPLOYEE']);
