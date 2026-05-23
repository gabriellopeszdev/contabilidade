import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETORES_VALIDOS = ['FISCAL', 'PESSOAL', 'CONTABIL'];

// =============================================================================
// PUT /api/v1/equipe/:id — Atualiza funcionário
// =============================================================================

export const PUT = withAuth(async (req, ctx, auth) => {
  try {
    const funcionarioId = ctx.params.id;

    // Verifica ownership: o funcionário pertence ao contador autenticado
    const existente = await prisma.funcionario.findFirst({
      where: { id: funcionarioId, contadorId: auth.sub, deletedAt: null },
    });

    if (!existente) {
      return NextResponse.json({ message: 'Funcionário não encontrado.' }, { status: 404 });
    }

    const body = await req.json();
    const { name, phone, setores, isActive } = body as {
      name?: string;
      phone?: string;
      setores?: string[];
      isActive?: boolean;
    };

    if (setores) {
      if (setores.length === 0) {
        return NextResponse.json({ message: 'Selecione pelo menos um setor.' }, { status: 400 });
      }
      const inv = setores.filter((s) => !SETORES_VALIDOS.includes(s));
      if (inv.length > 0) {
        return NextResponse.json({ message: `Setores inválidos: ${inv.join(', ')}` }, { status: 400 });
      }
    }

    const funcionario = await prisma.funcionario.update({
      where: { id: funcionarioId },
      data: {
        ...(name     !== undefined ? { name: name.trim() } : {}),
        ...(phone    !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(setores  !== undefined ? { setores: setores as ('FISCAL' | 'PESSOAL' | 'CONTABIL')[] } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: {
        id:        true,
        name:      true,
        email:     true,
        phone:     true,
        setores:   true,
        vinculo:   true,
        isActive:  true,
        createdAt: true,
      },
    });

    return NextResponse.json({ funcionario });
  } catch (err) {
    logger.error('[PUT /equipe/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro ao atualizar funcionário.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// DELETE /api/v1/equipe/:id — Soft-delete do funcionário
// =============================================================================

export const DELETE = withAuth(async (_req, ctx, auth) => {
  try {
    const funcionarioId = ctx.params.id;

    const existente = await prisma.funcionario.findFirst({
      where: { id: funcionarioId, contadorId: auth.sub, deletedAt: null },
    });

    if (!existente) {
      return NextResponse.json({ message: 'Funcionário não encontrado.' }, { status: 404 });
    }

    await prisma.funcionario.update({
      where: { id: funcionarioId },
      data:  { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ message: 'Funcionário removido com sucesso.' });
  } catch (err) {
    logger.error('[DELETE /equipe/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro ao remover funcionário.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
