import { NextResponse } from 'next/server';
import { withAuth }     from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }       from '../../../../../../src/infrastructure/di/Container';
import { AsaasService } from '../../../../../../src/infrastructure/asaas/AsaasService';
import { logger }       from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /api/v1/financeiro/assinaturas/[id] — Cancela assinatura
export const DELETE = withAuth(async (_req, ctx, auth) => {
  try {
    if (auth.role !== 'ACCOUNTANT' && auth.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    const { id } = await Promise.resolve(ctx.params);

    const assinatura = await prisma.assinaturaHonorario.findUnique({ where: { id } });
    if (!assinatura) {
      return NextResponse.json({ message: 'Assinatura não encontrada.' }, { status: 404 });
    }
    if (assinatura.escritorioId !== auth.sub) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    if (assinatura.asaasId) {
      const config = await prisma.configuracaoEscritorio.findUnique({
        where:  { contadorId: auth.sub },
        select: { asaasApiKey: true },
      });
      if (config?.asaasApiKey) {
        const svc = new AsaasService(config.asaasApiKey);
        // Cancela a assinatura (para futuras cobranças) e as pendentes já geradas
        await svc.cancelarAssinatura(assinatura.asaasId).catch(() => {});
        await svc.cancelarCobrancasPendentesAssinatura(assinatura.asaasId).catch(() => {});
      }
    }

    await prisma.assinaturaHonorario.update({
      where: { id },
      data:  { asaasStatus: 'INACTIVE' },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /financeiro/assinaturas/[id]]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
