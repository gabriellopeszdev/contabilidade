import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET  /api/v1/chat/rooms/[roomId] — Mensagens de uma sala (paginado)
// POST /api/v1/chat/rooms/[roomId] — Enviar mensagem
// PATCH /api/v1/chat/rooms/[roomId] — Marcar mensagens como lidas
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await verificarJWT(request);
  if (!auth.ok) return NextResponse.json({ message: auth.mensagem }, { status: auth.status });

  const { roomId } = await params;
  const { sub, role, contadorId } = auth.payload;

  // Verifica se o usuário tem acesso à sala
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ message: 'Sala não encontrada.' }, { status: 404 });

  const temAcesso = await verificarAcessoSala(sub, role, room.clienteId, contadorId);
  if (!temAcesso) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });

  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10)));

  const messages = await prisma.chatMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      senderId: true,
      senderType: true,
      content: true,
      documentId: true,
      readAt: true,
      createdAt: true,
      document: {
        select: { id: true, fileName: true, fileType: true, sector: true },
      },
    },
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({
    messages: items.reverse(), // ordem cronológica
    nextCursor,
    hasMore,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await verificarJWT(request);
  if (!auth.ok) return NextResponse.json({ message: auth.mensagem }, { status: auth.status });

  const { roomId } = await params;
  const { sub, role, nome, contadorId: contadorIdPost } = auth.payload;

  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ message: 'Sala não encontrada.' }, { status: 404 });

  const temAcesso = await verificarAcessoSala(sub, role, room.clienteId, contadorIdPost);
  if (!temAcesso) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const documentId = typeof body?.documentId === 'string' && body.documentId.match(/^[0-9a-f-]{36}$/i) ? body.documentId : null;

  if (!content || content.length > 2000) {
    return NextResponse.json(
      { message: 'Mensagem deve ter entre 1 e 2000 caracteres.' },
      { status: 400 },
    );
  }

  const senderType = role === 'CLIENT' ? 'CLIENTE' : 'CONTADOR';

  const message = await prisma.chatMessage.create({
    data: {
      roomId,
      senderId: sub,
      senderType,
      content,
      documentId,
    },
    select: {
      id: true,
      senderId: true,
      senderType: true,
      content: true,
      documentId: true,
      readAt: true,
      createdAt: true,
      document: {
        select: { id: true, fileName: true, fileType: true, sector: true },
      },
    },
  });

  return NextResponse.json({
    message: {
      ...message,
      senderNome: nome,
    },
    roomId,
    clienteId: room.clienteId,
  }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await verificarJWT(request);
  if (!auth.ok) return NextResponse.json({ message: auth.mensagem }, { status: auth.status });

  const { roomId } = await params;
  const { sub, role, contadorId: contadorIdPatch } = auth.payload;

  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ message: 'Sala não encontrada.' }, { status: 404 });

  const temAcesso = await verificarAcessoSala(sub, role, room.clienteId, contadorIdPatch);
  if (!temAcesso) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });

  // Marcar como lidas as mensagens que NÃO são do remetente logado
  const oppositeType = role === 'CLIENT' ? 'CONTADOR' : 'CLIENTE';

  const result = await prisma.chatMessage.updateMany({
    where: { roomId, senderType: oppositeType, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ marcadas: result.count });
}

// =============================================================================
// Helpers
// =============================================================================

async function verificarAcessoSala(
  userId: string,
  role: string,
  clienteIdDaSala: string,
  contadorId?: string,
): Promise<boolean> {
  if (role === 'CLIENT') {
    return userId === clienteIdDaSala;
  }
  // ACCOUNTANT/ADMIN — verifica vínculo pelo contadorId do escritório
  // Para funcionários: contadorId = superiorId (ID do contador dono do escritório)
  // Para o próprio contador: contadorId === undefined, usa userId
  const vinculo = await prisma.contadorCliente.findFirst({
    where: { contadorId: contadorId ?? userId, clienteId: clienteIdDaSala },
  });
  return !!vinculo;
}

interface JWTInfo {
  sub:        string;
  role:       'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
  nome:       string;
  contadorId?: string; // Para EMPLOYEE+ESCRITORIO: ID do escritório (para verificar acesso)
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
    const vinculo    = payload.vinculo    as string | undefined;
    const superiorId = payload.superiorId as string | undefined;
    let contadorId: string | undefined;

    // Funcionário de cliente → age como o próprio cliente
    if (role === 'EMPLOYEE' && vinculo === 'CLIENTE' && superiorId) {
      role = 'CLIENT';
      sub  = superiorId;
    }

    // Funcionário de escritório → sub permanece como ID próprio; contadorId para verificar acesso
    if (role === 'EMPLOYEE' && vinculo === 'ESCRITORIO' && superiorId) {
      role       = 'ACCOUNTANT';
      contadorId = superiorId;
    }

    if (!['CLIENT', 'ACCOUNTANT', 'ADMIN'].includes(role)) {
      return { ok: false, status: 403, mensagem: 'Acesso negado.' };
    }

    return {
      ok: true,
      payload: {
        sub,
        role: role as JWTInfo['role'],
        nome: (payload.nome as string) ?? 'Usuário',
        contadorId,
      },
    };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido.' };
  }
}
