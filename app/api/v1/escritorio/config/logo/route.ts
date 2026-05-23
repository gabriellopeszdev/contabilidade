import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

// =============================================================================
// POST /api/v1/escritorio/config/logo — Upload do logo do escritório
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  try {
    const formData = await req.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: 'Tipo de arquivo inválido. Permitidos: PNG, JPEG, WebP, SVG.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { message: 'Arquivo muito grande. Máximo: 2 MB.' },
        { status: 400 },
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const storagePath = `escritorio/${auth.sub}/logo-${randomUUID()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await storageService.upload(storagePath, buffer, file.type);

    // Atualiza ou cria configuração com o URL do logo
    const config = await prisma.configuracaoEscritorio.upsert({
      where: { contadorId: auth.sub },
      update: { logoUrl: storagePath },
      create: {
        contadorId: auth.sub,
        nomeEscritorio: 'Escritório Contábil',
        logoUrl: storagePath,
      },
    });

    // Gera presigned URL para exibição imediata no frontend
    let logoUrl: string | null = config.logoUrl;
    try {
      const { url } = await storageService.gerarPresignedUrlDownload(storagePath, 3600);
      logoUrl = url;
    } catch {
      // fallback: retorna o path bruto (frontend tratará)
    }

    return NextResponse.json({
      message: 'Logo atualizado com sucesso.',
      config: { logoUrl },
    });
  } catch (err) {
    logger.error('[POST /escritorio/config/logo] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro ao fazer upload do logo.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// DELETE /api/v1/escritorio/config/logo — Remove o logo do escritório
// =============================================================================

export const DELETE = withAuth(async (_req, _ctx, auth) => {
  try {
    const config = await prisma.configuracaoEscritorio.findUnique({
      where: { contadorId: auth.sub },
      select: { logoUrl: true },
    });

    if (!config?.logoUrl) {
      return NextResponse.json({ message: 'Nenhum logo para remover.' }, { status: 404 });
    }

    // Remove arquivo do MinIO (best-effort)
    try {
      await storageService.deletar(config.logoUrl);
    } catch {
      // Se falhar a remoção do arquivo, ainda assim limpa a referência no banco
    }

    await prisma.configuracaoEscritorio.update({
      where: { contadorId: auth.sub },
      data: { logoUrl: null },
    });

    return NextResponse.json({ message: 'Logo removido com sucesso.' });
  } catch (err) {
    logger.error('[DELETE /escritorio/config/logo] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro ao remover logo.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
