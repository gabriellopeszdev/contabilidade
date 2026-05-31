import { NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../../src/utils/logger';
import { IA_PROVIDERS, type IaProvider } from '../../../../../../../src/utils/aiProviders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_IDS = new Set<string>(IA_PROVIDERS.map((p) => p.id));

// =============================================================================
// GET /api/v1/admin/contadores/[id]/ia
// Retorna o provider e se há chave customizada para o contador
// =============================================================================

export const GET = withAuth(async (_req, ctx) => {
  const { id } = (ctx as ResolvedRouteContext).params;
  try {
    const config = await prisma.configuracaoEscritorio.findUnique({
      where:  { contadorId: id },
      select: { iaProvider: true, iaApiKey: true },
    });

    return NextResponse.json({
      iaProvider:     config?.iaProvider ?? null,
      iaKeySet:       Boolean(config?.iaApiKey),
      iaPersonalizada: Boolean(config?.iaApiKey),
    });
  } catch (err) {
    logger.error('[GET /admin/contadores/[id]/ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);

// =============================================================================
// PUT /api/v1/admin/contadores/[id]/ia
// Salva ou limpa o provider/chave personalizado do contador
// Body: { iaProvider: string; iaApiKey: string } | { clear: true }
// =============================================================================

export const PUT = withAuth(async (req, ctx) => {
  const { id } = (ctx as ResolvedRouteContext).params;
  try {
    const body = await req.json() as { iaProvider?: string; iaApiKey?: string; clear?: boolean };

    // Limpar personalização: volta para o padrão do sistema
    if (body.clear === true) {
      await prisma.configuracaoEscritorio.upsert({
        where:  { contadorId: id },
        update: { iaProvider: null, iaApiKey: null },
        create: { contadorId: id, nomeEscritorio: 'Escritório Contábil', iaProvider: null, iaApiKey: null },
      });
      return NextResponse.json({ ok: true, iaPersonalizada: false });
    }

    const { iaProvider, iaApiKey } = body;

    if (!iaProvider || !PROVIDER_IDS.has(iaProvider)) {
      return NextResponse.json(
        { message: `Provider inválido. Use: ${[...PROVIDER_IDS].join(', ')}` },
        { status: 400 },
      );
    }

    if (!iaApiKey || iaApiKey.trim().length < 10) {
      return NextResponse.json(
        { message: 'Chave de API inválida (mínimo 10 caracteres).' },
        { status: 400 },
      );
    }

    await prisma.configuracaoEscritorio.upsert({
      where:  { contadorId: id },
      update: { iaProvider: iaProvider as IaProvider, iaApiKey: iaApiKey.trim() },
      create: {
        contadorId:    id,
        nomeEscritorio: 'Escritório Contábil',
        iaProvider:    iaProvider as IaProvider,
        iaApiKey:      iaApiKey.trim(),
      },
    });

    return NextResponse.json({ ok: true, iaPersonalizada: true });
  } catch (err) {
    logger.error('[PUT /admin/contadores/[id]/ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
