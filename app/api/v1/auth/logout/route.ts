import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

import { prisma } from '@/infrastructure/di/Container';
import { getClientIp } from '@/utils/rateLimiter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Tenta extrair userId do token para registrar o audit log
  const token = request.cookies.get('fiscohub_token')?.value
    ?? request.headers.get('authorization')?.replace('Bearer ', '');

  if (token) {
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
        if (payload.sub) {
          const ip = getClientIp(request);
          prisma.auditLog.create({
            data: {
              userId:       payload.sub,
              actionType:   'LOGOUT',
              resourceType: 'SESSION',
              detailsJson:  {},
              ipAddress:    ip,
              userAgent:    request.headers.get('user-agent'),
            },
          }).catch(() => {});
        }
      } catch {
        // Token expirado ou inválido — logout continua normalmente
      }
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('fiscohub_token', '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   0,
  });
  return response;
}
