import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify }                from 'jose';
import { prisma }                   from '../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/chat/equipe
//
// Retorna o time do escritório contábil vinculado ao cliente autenticado:
//   - O contador principal (tipo CONTADOR)
//   - Os funcionários ativos do escritório (tipo FUNCIONARIO)
//
// Acesso: apenas CLIENT (ou EMPLOYEE de vínculo CLIENTE)
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await verificarJWT(request);
  if (!auth.ok) return NextResponse.json({ message: auth.mensagem }, { status: auth.status });

  const { clienteId } = auth;

  // Acha o vínculo do cliente com seu escritório
  const vinculo = await prisma.contadorCliente.findFirst({
    where:  { clienteId },
    select: { contadorId: true },
  });

  if (!vinculo) {
    return NextResponse.json({ equipe: [] });
  }

  const { contadorId } = vinculo;

  // Busca contador + funcionários do escritório em paralelo
  const [contador, funcionarios] = await Promise.all([
    prisma.usuarioContador.findUnique({
      where:  { id: contadorId },
      select: { id: true, name: true, avatarUrl: true },
    }),
    prisma.funcionario.findMany({
      where: {
        contadorId,
        vinculo:   'ESCRITORIO',
        isActive:  true,
        deletedAt: null,
      },
      select: { id: true, name: true, setores: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const equipe = [
    ...(contador
      ? [{ id: contador.id, nome: contador.name, tipo: 'CONTADOR' as const, setores: ['TODOS' as const], avatarUrl: contador.avatarUrl }]
      : []),
    ...funcionarios.map((f) => ({
      id:       f.id,
      nome:     f.name,
      tipo:     'FUNCIONARIO' as const,
      setores:  f.setores,
      avatarUrl: f.avatarUrl,
    })),
  ];

  return NextResponse.json({ equipe });
}

// =============================================================================
// Helper JWT
// =============================================================================

async function verificarJWT(
  request: NextRequest,
): Promise<{ ok: true; clienteId: string } | { ok: false; status: number; mensagem: string }> {
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) token = request.cookies.get('contabilidade_jwt')?.value ?? null;
  if (!token) return { ok: false, status: 401, mensagem: 'Token ausente.' };

  const secret = process.env.JWT_SECRET;
  if (!secret) return { ok: false, status: 500, mensagem: 'Erro de configuração.' };

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });

    const role       = payload.role as string;
    const sub        = payload.sub as string;
    const vinculo    = payload.vinculo as string | undefined;
    const superiorId = payload.superiorId as string | undefined;

    if (role === 'CLIENT') {
      return { ok: true, clienteId: sub };
    }

    if (role === 'EMPLOYEE' && vinculo === 'CLIENTE' && superiorId) {
      return { ok: true, clienteId: superiorId };
    }

    return { ok: false, status: 403, mensagem: 'Acesso negado.' };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido.' };
  }
}
