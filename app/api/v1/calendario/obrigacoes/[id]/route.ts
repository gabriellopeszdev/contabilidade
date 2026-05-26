import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PUT /api/v1/calendario/obrigacoes/:id — Atualiza obrigação fiscal
// =============================================================================

export const PUT = withAuth(async (req, ctx, auth) => {
  try {
    const id = (ctx.params as { id: string }).id;

    const obrigacao = await prisma.obrigacaoFiscal.findFirst({
      where: { id, contadorId: auth.sub, ativo: true },
    });

    if (!obrigacao) {
      return NextResponse.json({ message: 'Obrigação não encontrada.' }, { status: 404 });
    }

    const body = await req.json();
    const {
      nome,
      descricao,
      diaVencimento,
      cor,
      recorrencia,
      lembreteAntecedencia,
      lembreteEmail,
      lembreteNotificacao,
      mesesAplicacao,
    } = body as {
      nome?: string;
      descricao?: string;
      diaVencimento?: number;
      cor?: string;
      recorrencia?: 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | null;
      lembreteAntecedencia?: number;
      lembreteEmail?: boolean;
      lembreteNotificacao?: boolean;
      mesesAplicacao?: number[];
    };

    if (nome !== undefined && (nome.length < 2 || nome.length > 100)) {
      return NextResponse.json({ message: 'Nome inválido (2-100 caracteres).' }, { status: 400 });
    }

    if (diaVencimento !== undefined && (diaVencimento < 1 || diaVencimento > 31)) {
      return NextResponse.json({ message: 'Dia de vencimento inválido (1-31).' }, { status: 400 });
    }

    const updated = await prisma.obrigacaoFiscal.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(descricao !== undefined && { descricao: descricao ?? null }),
        ...(diaVencimento !== undefined && { diaVencimento }),
        ...(cor !== undefined && { cor }),
        ...(recorrencia !== undefined && { recorrencia: recorrencia ?? null }),
        ...(lembreteAntecedencia !== undefined && { lembreteAntecedencia }),
        ...(lembreteEmail !== undefined && { lembreteEmail }),
        ...(lembreteNotificacao !== undefined && { lembreteNotificacao }),
        ...(mesesAplicacao !== undefined && { mesesAplicacao }),
      },
    });

    return NextResponse.json({ obrigacao: updated });
  } catch (err) {
    logger.error('[PUT /calendario/obrigacoes/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// DELETE /api/v1/calendario/obrigacoes/:id — Desativa obrigação fiscal
// =============================================================================

export const DELETE = withAuth(async (_req, ctx, auth) => {
  try {
    const id = (ctx.params as { id: string }).id;

    const obrigacao = await prisma.obrigacaoFiscal.findFirst({
      where: { id, contadorId: auth.sub, ativo: true },
    });

    if (!obrigacao) {
      return NextResponse.json({ message: 'Obrigação não encontrada.' }, { status: 404 });
    }

    await prisma.obrigacaoFiscal.update({
      where: { id },
      data: { ativo: false },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /calendario/obrigacoes/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
