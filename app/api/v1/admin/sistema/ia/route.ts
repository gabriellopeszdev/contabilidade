import { NextResponse } from 'next/server';

import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../src/utils/logger';
import { IA_PROVIDERS, type IaProvider } from '../../../../../../src/utils/aiProviders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER_IDS = new Set<string>(IA_PROVIDERS.map((p) => p.id));

// =============================================================================
// GET /api/v1/admin/sistema/ia — Retorna config de IA do sistema
// =============================================================================

export const GET = withAuth(async () => {
  try {
    const config = await prisma.configuracaoSistema.findUnique({
      where:  { id: 'system' },
      select: { iaProvider: true, iaApiKey: true },
    });

    return NextResponse.json({
      iaProvider: config?.iaProvider ?? null,
      iaKeySet:   Boolean(config?.iaApiKey),
    });
  } catch (err) {
    logger.error('[GET /admin/sistema/ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);

// =============================================================================
// PUT /api/v1/admin/sistema/ia — Salva provider e chave de API do sistema
// =============================================================================

export const PUT = withAuth(async (req) => {
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

    await prisma.configuracaoSistema.upsert({
      where:  { id: 'system' },
      update: { iaProvider: iaProvider as IaProvider, iaApiKey: iaApiKey.trim() },
      create: { id: 'system', iaProvider: iaProvider as IaProvider, iaApiKey: iaApiKey.trim() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PUT /admin/sistema/ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
