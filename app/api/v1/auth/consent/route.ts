import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

import { prisma } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Versão vigente do Termo de Consentimento LGPD */
const CONSENT_VERSION = '1.0';

// =============================================================================
// GET  — Verifica se o usuário já aceitou a versão vigente
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await extrairPayload(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.mensagem }, { status: auth.status });
  }

  const { sub, role } = auth.payload;

  try {
    let consentVersion: string | null | undefined;

    if (role === 'CLIENT') {
      consentVersion = (await prisma.usuarioCliente.findUnique({ where: { id: sub }, select: { consentVersion: true } }))?.consentVersion;
    } else if (role === 'EMPLOYEE') {
      consentVersion = (await prisma.funcionario.findUnique({ where: { id: sub }, select: { consentVersion: true } }))?.consentVersion;
    } else {
      consentVersion = (await prisma.usuarioContador.findUnique({ where: { id: sub }, select: { consentVersion: true } }))?.consentVersion;
    }

    return NextResponse.json({
      necessario: consentVersion !== CONSENT_VERSION,
      versaoAtual: CONSENT_VERSION,
      versaoAceita: consentVersion ?? null,
    });
  } catch (error) {
    logger.error('[GET /auth/consent] Erro', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { message: 'Falha ao verificar consentimento.' },
      { status: 500 },
    );
  }
}

// =============================================================================
// POST — Registra aceite do consentimento
// =============================================================================

export async function POST(request: NextRequest) {
  const auth = await extrairPayload(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.mensagem }, { status: auth.status });
  }

  const { sub, role } = auth.payload;

  const ipAddress =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0';

  const now = new Date();

  const updateData = {
    consentVersion: CONSENT_VERSION,
    consentAcceptedAt: now,
    consentIpAddress: ipAddress,
  };

  try {
    // Verificar se o usuário existe antes de atualizar
    let usuario: { id: string } | null = null;

    if (role === 'CLIENT') {
      usuario = await prisma.usuarioCliente.findUnique({ where: { id: sub }, select: { id: true } });
    } else if (role === 'EMPLOYEE') {
      usuario = await prisma.funcionario.findUnique({ where: { id: sub }, select: { id: true } });
    } else {
      usuario = await prisma.usuarioContador.findUnique({ where: { id: sub }, select: { id: true } });
    }

    if (!usuario) {
      return NextResponse.json(
        { message: 'Usuário não encontrado. Faça login novamente.' },
        { status: 401 },
      );
    }

    if (role === 'CLIENT') {
      await prisma.usuarioCliente.update({ where: { id: sub }, data: updateData });
    } else if (role === 'EMPLOYEE') {
      await prisma.funcionario.update({ where: { id: sub }, data: updateData });
    } else {
      await prisma.usuarioContador.update({ where: { id: sub }, data: updateData });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: sub,
        actionType: 'CONSENT_ACCEPTED',
        resourceType: 'USER',
        ipAddress,
        userAgent: request.headers.get('user-agent') ?? undefined,
        detailsJson: { version: CONSENT_VERSION, acceptedAt: now.toISOString() },
      },
    });
  } catch (error) {
    logger.error('[POST /auth/consent] Erro', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { message: 'Falha ao registrar consentimento.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ aceito: true, versao: CONSENT_VERSION });
}

// =============================================================================
// Helper — Extrair payload JWT
// =============================================================================

interface JWTInfo {
  sub: string;
  role: 'CLIENT' | 'ACCOUNTANT' | 'ADMIN' | 'EMPLOYEE';
  superiorId?: string;
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
        superiorId: (payload as Record<string, unknown>).superiorId as string | undefined,
      },
    };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido ou expirado.' };
  }
}
