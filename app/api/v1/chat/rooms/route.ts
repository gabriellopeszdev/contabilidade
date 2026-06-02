import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/chat/rooms
//
// CLIENT  → retorna uma sala por membro do escritório (contador + funcionários).
//           Cria as salas ausentes automaticamente.
// ACCOUNTANT/EMPLOYEE_ESCRITORIO → retorna salas onde memberId = sub (salas do
//           contador/funcionário com cada um de seus clientes).
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await verificarJWT(request);
  if (!auth.ok) return NextResponse.json({ message: auth.mensagem }, { status: auth.status });

  const { sub, role, contadorId: contadorIdJwt, memberType } = auth.payload;

  // ── Cliente ────────────────────────────────────────────────────────────────
  if (role === 'CLIENT') {
    const vinculo = await prisma.contadorCliente.findFirst({
      where:  { clienteId: sub },
      select: { contadorId: true },
    });
    if (!vinculo) return NextResponse.json({ rooms: [] });

    const { contadorId } = vinculo;

    // Monta lista de membros: contador + funcionários ativos
    const [contador, funcionarios] = await Promise.all([
      prisma.usuarioContador.findUnique({
        where:  { id: contadorId },
        select: { id: true, name: true, avatarUrl: true },
      }),
      prisma.funcionario.findMany({
        where: { contadorId, vinculo: 'ESCRITORIO', isActive: true, deletedAt: null },
        select: { id: true, name: true, setores: true, avatarUrl: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    type Membro = { id: string; nome: string; tipo: 'CONTADOR' | 'FUNCIONARIO'; setores: string[]; avatarUrl: string | null };
    const membros: Membro[] = [
      ...(contador ? [{ id: contador.id, nome: contador.name, tipo: 'CONTADOR' as const, setores: ['TODOS'], avatarUrl: contador.avatarUrl }] : []),
      ...funcionarios.map((f) => ({ id: f.id, nome: f.name, tipo: 'FUNCIONARIO' as const, setores: f.setores as string[], avatarUrl: f.avatarUrl })),
    ];

    if (membros.length === 0) return NextResponse.json({ rooms: [] });

    // Upsert: garante que existe uma sala para cada membro
    await Promise.all(
      membros.map((m) =>
        prisma.chatRoom.upsert({
          where:  { clienteId_memberId: { clienteId: sub, memberId: m.id } },
          update: {},
          create: {
            clienteId:  sub,
            memberId:   m.id,
            memberType: m.tipo === 'CONTADOR' ? 'CONTADOR' : 'FUNCIONARIO',
          },
        }),
      ),
    );

    // Busca as salas com preview
    const rooms = await prisma.chatRoom.findMany({
      where:   { clienteId: sub },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take:    1,
          select:  { content: true, createdAt: true, senderType: true },
        },
        _count: {
          select: { messages: { where: { readAt: null, senderType: 'CONTADOR' } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mapeia membros por id para enriquecer
    const membroMap = new Map(membros.map((m) => [m.id, m]));

    return NextResponse.json({
      rooms: rooms.map((r) => {
        const m = membroMap.get(r.memberId);
        return {
          id:             r.id,
          clienteId:      r.clienteId,
          clienteNome:    '',       // não usado na visão cliente
          clienteCnpj:    '',
          clienteAvatar:  null,
          membroId:       r.memberId,
          membroNome:     m?.nome ?? 'Desconhecido',
          membroTipo:     r.memberType,
          membroSetores:  m?.setores ?? [],
          membroAvatar:   m?.avatarUrl ?? null,
          ultimaMensagem: r.messages[0] ?? null,
          naoLidas:       r._count.messages,
          createdAt:      r.createdAt,
        };
      }),
    });
  }

  // ── Contador / Funcionário do Escritório ───────────────────────────────────
  // contadorIdJwt: só existe para funcionários do escritório (superiorId do JWT)
  const escritorioId = contadorIdJwt ?? sub;

  // Garante que existe uma sala para cada cliente do escritório (upsert idempotente)
  const clientes = await prisma.contadorCliente.findMany({
    where:  { contadorId: escritorioId },
    select: { clienteId: true },
  });

  if (clientes.length > 0) {
    await Promise.all(
      clientes.map((c) =>
        prisma.chatRoom.upsert({
          where:  { clienteId_memberId: { clienteId: c.clienteId, memberId: sub } },
          update: {},
          create: { clienteId: c.clienteId, memberId: sub, memberType },
        }),
      ),
    );
  }

  const rooms = await prisma.chatRoom.findMany({
    where: { memberId: sub },
    include: {
      cliente: { select: { id: true, name: true, cnpj: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take:    1,
        select:  { content: true, createdAt: true, senderType: true },
      },
      _count: {
        select: { messages: { where: { readAt: null, senderType: 'CLIENTE' } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      id:             r.id,
      clienteId:      r.clienteId,
      clienteNome:    r.cliente.name,
      clienteCnpj:    r.cliente.cnpj,
      clienteAvatar:  r.cliente.avatarUrl,
      ultimaMensagem: r.messages[0] ?? null,
      naoLidas:       r._count.messages,
      createdAt:      r.createdAt,
    })),
  });
}

// =============================================================================
// Helper JWT
// =============================================================================

interface JWTInfo {
  sub:        string;
  role:       'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
  nome:       string;
  // Para EMPLOYEE+ESCRITORIO: contadorId é o superiorId; sub permanece como o próprio ID do funcionário
  contadorId?: string;
  memberType: 'CONTADOR' | 'FUNCIONARIO';
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

    let contadorId:  string | undefined;
    let memberType: 'CONTADOR' | 'FUNCIONARIO' = 'CONTADOR';

    if (role === 'EMPLOYEE' && vinculo === 'CLIENTE' && superiorId) {
      // Funcionário do cliente → age como o próprio cliente
      role = 'CLIENT';
      sub  = superiorId;
    } else if (role === 'EMPLOYEE' && vinculo === 'ESCRITORIO' && superiorId) {
      // Funcionário do escritório → tem salas próprias; contadorId indica de qual escritório é
      role       = 'ACCOUNTANT';
      contadorId = superiorId;
      memberType = 'FUNCIONARIO';
      // sub permanece como ID do próprio funcionário (não substituímos por superiorId)
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
        memberType,
      },
    };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido.' };
  }
}
