import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

import { prisma } from '../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/auth/audit-log — Histórico de acessos do usuário (LGPD)
//
// Query params:
//   - page (default: 1)
//   - limit (default: 20, max: 100)
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await extrairPayload(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.mensagem }, { status: auth.status });
  }

  const { sub } = auth.payload;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId: sub },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        actionType: true,
        resourceType: true,
        timestamp: true,
        ipAddress: true,
        detailsJson: true,
      },
    }),
    prisma.auditLog.count({ where: { userId: sub } }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// =============================================================================
// Helper — Extrair payload JWT
// =============================================================================

interface JWTInfo {
  sub: string;
  role: 'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
}

async function extrairPayload(
  request: NextRequest,
): Promise<{ ok: true; payload: JWTInfo } | { ok: false; status: 401 | 500; mensagem: string }> {
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    token = request.cookies.get('contabilidade_jwt')?.value ?? null;
  }

  if (!token) {
    return { ok: false, status: 401, mensagem: 'Token de autorização ausente.' };
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false, status: 500, mensagem: 'Erro de configuração do servidor.' };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ['HS256'] },
    );
    return {
      ok: true,
      payload: {
        sub: payload.sub as string,
        role: payload.role as JWTInfo['role'],
      },
    };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido ou expirado.' };
  }
}
