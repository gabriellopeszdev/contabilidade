import { NextResponse } from 'next/server';

import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../src/utils/logger';
import { IA_PROVIDERS, type IaProvider } from '../../../../../src/utils/aiProviders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_IDS = new Set<string>(IA_PROVIDERS.map((p) => p.id));

// =============================================================================
// GET /api/v1/escritorio/ia — Retorna provider ativo e se a chave está salva
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const config = await prisma.configuracaoEscritorio.findUnique({
      where:  { contadorId: auth.sub },
      select: { iaProvider: true, iaApiKey: true },
    });

    return NextResponse.json({
      iaProvider:  config?.iaProvider ?? null,
      iaKeySet:    Boolean(config?.iaApiKey),
    });
  } catch (err) {
    logger.error('[GET /escritorio/ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);

// =============================================================================
// PUT /api/v1/escritorio/ia — Salva provider e chave de API
// =============================================================================

export const PUT = withAuth(async (req, _ctx, auth) => {
  try {
    const body = await req.json() as { iaProvider?: string; iaApiKey?: string };

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
      where:  { contadorId: auth.sub },
      update: { iaProvider: iaProvider as IaProvider, iaApiKey: iaApiKey.trim() },
      create: {
        contadorId: auth.sub,
        iaProvider: iaProvider as IaProvider,
        iaApiKey:   iaApiKey.trim(),
        nomeEscritorio: 'Escritório Contábil',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PUT /escritorio/ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
