import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/chat/unread — Total de mensagens não lidas (para badge)
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await verificarJWT(request);
  if (!auth.ok) return NextResponse.json({ message: auth.mensagem }, { status: auth.status });

  const { sub, role } = auth.payload;

  if (role === 'CLIENT') {
    const rooms = await prisma.chatRoom.findMany({
      where:  { clienteId: sub },
      select: { id: true },
    });
    if (rooms.length === 0) return NextResponse.json({ total: 0 });

    const total = await prisma.chatMessage.count({
      where: {
        roomId:     { in: rooms.map((r) => r.id) },
        senderType: 'CONTADOR',
        readAt:     null,
      },
    });

    return NextResponse.json({ total });
  }

  // ACCOUNTANT/ADMIN
  const vinculos = await prisma.contadorCliente.findMany({
    where: { contadorId: sub },
    select: { clienteId: true },
  });

  if (vinculos.length === 0) return NextResponse.json({ total: 0 });

  const rooms = await prisma.chatRoom.findMany({
    where: { clienteId: { in: vinculos.map((v) => v.clienteId) } },
    select: { id: true },
  });

  if (rooms.length === 0) return NextResponse.json({ total: 0 });

  const total = await prisma.chatMessage.count({
    where: {
      roomId: { in: rooms.map((r) => r.id) },
      senderType: 'CLIENTE',
      readAt: null,
    },
  });

  return NextResponse.json({ total });
}

// =============================================================================
// Helper JWT
// =============================================================================

interface JWTInfo {
  sub: string;
  role: 'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
}

async function verificarJWT(
  request: NextRequest,
): Promise<{ ok: true; payload: JWTInfo } | { ok: false; status: number; mensagem: string }> {
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) token = request.cookies.get('contabilidade_jwt')?.value ?? null;
  if (!token) return { ok: false, status: 401, mensagem: 'Token ausente.' };

  const secret = process.env.JWT_SECRET;
  if (!secret) return { ok: false, status: 500, mensagem: 'Erro de configuração.' };

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });

    let role = payload.role as string;
    let sub  = payload.sub as string;
    const vinculo    = payload.vinculo as string | undefined;
    const superiorId = payload.superiorId as string | undefined;

    // Funcionário de cliente → tratar como CLIENT usando o ID do patrão
    if (role === 'EMPLOYEE' && vinculo === 'CLIENTE' && superiorId) {
      role = 'CLIENT';
      sub  = superiorId;
    }

    // Funcionário de escritório → tratar como ACCOUNTANT usando o ID do contador
    if (role === 'EMPLOYEE' && vinculo === 'ESCRITORIO' && superiorId) {
      role = 'ACCOUNTANT';
      sub  = superiorId;
    }

    if (!['CLIENT', 'ACCOUNTANT', 'ADMIN'].includes(role)) {
      return { ok: false, status: 403, mensagem: 'Acesso negado.' };
    }

    return { ok: true, payload: { sub, role: role as JWTInfo['role'] } };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido.' };
  }
}
