import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

import { prisma }   from '../../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../../src/utils/logger';
import { withAuth } from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext } from '../../../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/admin/contadores/:id/impersonar
//
// Gera um token de impersonação de curta duração (1h) para que um admin
// possa acessar a plataforma como se fosse o contador alvo, para fins de
// suporte. O token carrega a claim `impersonadoPor` com o UUID do admin.
//
// Restrições:
//   - Apenas admins podem chamar este endpoint.
//   - Não é permitido impersonar outro admin (evita escalonamento de privilégio).
//   - O admin alvo precisa estar ativo e não ter sido excluído.
//
// Auditoria: grava IMPERSONATION_INICIADA com userId = admin, resourceType = USER.
// =============================================================================

export const POST = withAuth(async (
  req: NextRequest,
  ctx: { params: Record<string, string> },
  auth,
): Promise<NextResponse> => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '0.0.0.0';
  const { id } = ctx.params;

  // --------------------------------------------------------------------------
  // 1. Buscar contador alvo
  // --------------------------------------------------------------------------
  let contador: { id: string; name: string; email: string; isAdmin: boolean; isActive: boolean; deletedAt: Date | null } | null;
  try {
    contador = await prisma.usuarioContador.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, isAdmin: true, isActive: true, deletedAt: true },
    });
  } catch (err) {
    logger.error('[POST /admin/contadores/:id/impersonar] Erro ao buscar contador', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }

  if (!contador || contador.deletedAt) {
    return NextResponse.json({ message: 'Contador não encontrado.' }, { status: 404 });
  }

  if (!contador.isActive) {
    return NextResponse.json({ message: 'Não é possível impersonar um contador inativo.' }, { status: 403 });
  }

  // --------------------------------------------------------------------------
  // 2. Bloquear impersonação de admin (evita escalonamento de privilégio)
  // --------------------------------------------------------------------------
  if (contador.isAdmin) {
    return NextResponse.json(
      { message: 'Não é permitido impersonar outro administrador.' },
      { status: 403 },
    );
  }

  // --------------------------------------------------------------------------
  // 3. Gerar token de impersonação (role ACCOUNTANT, expira em 1h)
  // --------------------------------------------------------------------------
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.fatal('[POST /admin/contadores/:id/impersonar] JWT_SECRET não configurado');
    return NextResponse.json({ message: 'Erro de configuração do servidor.' }, { status: 500 });
  }

  const token = await new SignJWT({
    role:           'ACCOUNTANT',
    nome:           contador.name,
    impersonadoPor: auth.sub,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(contador.id)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));

  // --------------------------------------------------------------------------
  // 4. Gravar AuditLog (fire-and-forget)
  // --------------------------------------------------------------------------
  prisma.auditLog.create({
    data: {
      userId:       auth.sub,
      actionType:   'IMPERSONATION_INICIADA',
      resourceType: 'USER',
      detailsJson:  { contadorAlvoId: contador.id, contadorAlvoNome: contador.name },
      ipAddress:    ip,
    },
  }).catch(() => {});

  return NextResponse.json({ token });
}, ['ADMIN']);
