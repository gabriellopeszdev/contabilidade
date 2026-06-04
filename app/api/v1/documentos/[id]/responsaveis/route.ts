import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/documentos/[id]/responsaveis
// Lista os funcionários atribuídos a um documento.
// =============================================================================

export const GET = withAuth(async (_req: NextRequest, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const doc = await prisma.documentoFiscal.findFirst({
      where: {
        id,
        deletedAt: null,
        cliente: { contadoresRel: { some: { contadorId } } },
      },
      select: { id: true },
    });

    if (!doc) {
      return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
    }

    const responsaveis = await prisma.documentoResponsavel.findMany({
      where: { documentoId: id },
      select: {
        funcionario: { select: { id: true, name: true } },
        assignedAt:  true,
      },
    });

    return NextResponse.json({
      responsaveis: responsaveis.map((r) => ({
        id:         r.funcionario.id,
        name:       r.funcionario.name,
        assignedAt: r.assignedAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error('[GET /documentos/:id/responsaveis] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);

// =============================================================================
// PATCH /api/v1/documentos/[id]/responsaveis
// Substitui a lista de responsáveis do documento.
// Body: { funcionarioIds: string[] }
// =============================================================================

export const PATCH = withAuth(async (req: NextRequest, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  let body: { funcionarioIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'JSON inválido.' }, { status: 400 });
  }

  const funcionarioIds = Array.isArray(body.funcionarioIds) ? body.funcionarioIds : [];

  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const doc = await prisma.documentoFiscal.findFirst({
      where: {
        id,
        deletedAt: null,
        cliente: { contadoresRel: { some: { contadorId } } },
      },
      select: { id: true },
    });

    if (!doc) {
      return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
    }

    // Valida que todos os funcionários pertencem ao escritório do contador
    if (funcionarioIds.length > 0) {
      const funcionarios = await prisma.funcionario.findMany({
        where: { id: { in: funcionarioIds }, contadorId, deletedAt: null },
        select: { id: true },
      });
      if (funcionarios.length !== funcionarioIds.length) {
        return NextResponse.json({ message: 'Um ou mais funcionários não encontrados.' }, { status: 404 });
      }
    }

    // Substitui todos os responsáveis em transação
    await prisma.$transaction([
      prisma.documentoResponsavel.deleteMany({ where: { documentoId: id } }),
      ...(funcionarioIds.length > 0
        ? [
            prisma.documentoResponsavel.createMany({
              data: funcionarioIds.map((funcionarioId) => ({
                documentoId:  id,
                funcionarioId,
                assignedById: auth.sub,
              })),
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PATCH /documentos/:id/responsaveis] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
