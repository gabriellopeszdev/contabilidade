import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

/** Converte storagePath do MinIO em presigned URL (1h). Retorna null se vazio. */
async function resolverLogoUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null;
  try {
    const { url } = await storageService.gerarPresignedUrlDownload(storagePath, 3600);
    return url;
  } catch {
    return null;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/escritorio/config — Retorna a configuração White Label
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    let contadorId: string;

    if (auth.role === 'EMPLOYEE') {
      contadorId = auth.superiorId!;
    } else if (auth.role === 'CLIENT') {
      // Cliente: encontrar o contadorId pelo vínculo ContadorCliente
      const vinculo = await prisma.contadorCliente.findFirst({
        where: { clienteId: auth.sub },
        select: { contadorId: true },
      });
      if (!vinculo) {
        return NextResponse.json({ config: { nomeEscritorio: '', logoUrl: null, corPrimaria: '#2563eb', corSecundaria: '#1e3a8a' } });
      }
      contadorId = vinculo.contadorId;
    } else {
      contadorId = auth.sub;
    }

    const config = await prisma.configuracaoEscritorio.findUnique({
      where: { contadorId },
    });

    if (!config) {
      return NextResponse.json({
        config: {
          nomeEscritorio: '',
          cnpjEscritorio: null,
          logoUrl: null,
          corPrimaria: '#2563eb',
          corSecundaria: '#1e3a8a',
        },
      });
    }

    const logoUrl = await resolverLogoUrl(config.logoUrl);

    return NextResponse.json({
      config: {
        id: config.id,
        nomeEscritorio: config.nomeEscritorio,
        cnpjEscritorio: config.cnpjEscritorio,
        logoUrl,
        corPrimaria: config.corPrimaria,
        corSecundaria: config.corSecundaria,
      },
    });
  } catch (err) {
    logger.error('[GET /escritorio/config] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE', 'CLIENT']);

// =============================================================================
// PUT /api/v1/escritorio/config — Atualiza/cria configuração (upsert)
// =============================================================================

export const PUT = withAuth(async (req, _ctx, auth) => {
  try {
    const body = await req.json();
    const { nomeEscritorio, cnpjEscritorio, corPrimaria, corSecundaria } = body as {
      nomeEscritorio?: string;
      cnpjEscritorio?: string;
      corPrimaria?: string;
      corSecundaria?: string;
    };

    // Valida cores (hex válido)
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    if (corPrimaria && !hexRegex.test(corPrimaria)) {
      return NextResponse.json({ message: 'Cor primária inválida.' }, { status: 400 });
    }
    if (corSecundaria && !hexRegex.test(corSecundaria)) {
      return NextResponse.json({ message: 'Cor secundária inválida.' }, { status: 400 });
    }

    const data = {
      nomeEscritorio: nomeEscritorio ?? 'Escritório Contábil',
      ...(cnpjEscritorio !== undefined ? { cnpjEscritorio } : {}),
      ...(corPrimaria ? { corPrimaria } : {}),
      ...(corSecundaria ? { corSecundaria } : {}),
    };

    const config = await prisma.configuracaoEscritorio.upsert({
      where: { contadorId: auth.sub },
      update: data,
      create: { contadorId: auth.sub, ...data },
    });

    const logoUrl = await resolverLogoUrl(config.logoUrl);

    return NextResponse.json({
      config: {
        id: config.id,
        nomeEscritorio: config.nomeEscritorio,
        cnpjEscritorio: config.cnpjEscritorio,
        logoUrl,
        corPrimaria: config.corPrimaria,
        corSecundaria: config.corSecundaria,
      },
    });
  } catch (err) {
    logger.error('[PUT /escritorio/config] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
