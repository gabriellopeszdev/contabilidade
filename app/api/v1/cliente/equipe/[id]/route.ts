import { NextResponse } from 'next/server';
import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }  from '../../../../../../src/infrastructure/di/Container';
import { logger }  from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETORES_VALIDOS = ['FISCAL', 'PESSOAL', 'CONTABIL', 'TODOS'];

// =============================================================================
// PATCH /api/v1/cliente/equipe/[id] — Atualiza membro da equipe
// =============================================================================

export const PATCH = withAuth(async (req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  try {
    const membro = await prisma.funcionario.findFirst({
      where: { id, clienteId: auth.sub, deletedAt: null },
    });

    if (!membro) {
      return NextResponse.json({ message: 'Membro não encontrado.' }, { status: 404 });
    }

    const body = await req.json();
    const { name, phone, setores, isActive } = body as {
      name?:     string;
      phone?:    string;
      setores?:  string[];
      isActive?: boolean;
    };

    if (setores !== undefined) {
      if (setores.length === 0) {
        return NextResponse.json({ message: 'Selecione pelo menos um setor.' }, { status: 400 });
      }
      const invalidos = setores.filter((s) => !SETORES_VALIDOS.includes(s));
      if (invalidos.length > 0) {
        return NextResponse.json({ message: `Setores inválidos: ${invalidos.join(', ')}` }, { status: 400 });
      }
    }

    const atualizado = await prisma.funcionario.update({
      where: { id },
      data: {
        ...(name     !== undefined && { name: name.trim() }),
        ...(phone    !== undefined && { phone: phone?.trim() || null }),
        ...(setores  !== undefined && { setores: setores as ('FISCAL' | 'PESSOAL' | 'CONTABIL' | 'TODOS')[] }),
        ...(isActive !== undefined && { isActive }),
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

    return NextResponse.json({ funcionario: atualizado });
  } catch (err) {
    logger.error('[PATCH /cliente/equipe/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['CLIENT']);

// =============================================================================
// DELETE /api/v1/cliente/equipe/[id] — Remove membro (soft delete)
// =============================================================================

export const DELETE = withAuth(async (_req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  try {
    const membro = await prisma.funcionario.findFirst({
      where: { id, clienteId: auth.sub, deletedAt: null },
    });

    if (!membro) {
      return NextResponse.json({ message: 'Membro não encontrado.' }, { status: 404 });
    }

    await prisma.funcionario.update({
      where: { id },
      data:  { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ message: 'Membro removido.' });
  } catch (err) {
    logger.error('[DELETE /cliente/equipe/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['CLIENT']);
