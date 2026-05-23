import { NextResponse } from 'next/server';
import { withAuth }    from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }      from '../../../../../../../src/infrastructure/di/Container';
import { logger }      from '../../../../../../../src/utils/logger';
import { AsaasService } from '../../../../../../../src/infrastructure/asaas/AsaasService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PUT /api/v1/admin/contadores/:id/asaas — Salva/remove chave Asaas do contador
//
// Body: { apiKey: string }  — vazio ("") remove a chave
// Acesso: role ADMIN apenas
// =============================================================================

export const PUT = withAuth(async (req, ctx, _auth) => {
  try {
    const contadorId = (ctx.params as { id: string }).id;

    const body = await req.json() as { apiKey?: string };
    const apiKey = (body.apiKey ?? '').trim();

    // Verifica se o contador existe
    const contador = await prisma.usuarioContador.findFirst({
      where: { id: contadorId, deletedAt: null },
      select: { id: true },
    });
    if (!contador) {
      return NextResponse.json({ message: 'Contador não encontrado.' }, { status: 404 });
    }

    // Se enviou chave, valida no Asaas antes de salvar
    let nomeEmpresa: string | undefined;
    if (apiKey) {
      const svc = new AsaasService(apiKey);
      const validacao = await svc.validarChave();
      if (!validacao.ok) {
        return NextResponse.json(
          { message: 'Chave Asaas inválida ou sem acesso. Verifique a key e tente novamente.' },
          { status: 400 },
        );
      }
      nomeEmpresa = validacao.nomeEmpresa;
    }

    // Upsert da configuração
    await prisma.configuracaoEscritorio.upsert({
      where:  { contadorId },
      update: { asaasApiKey: apiKey || null },
      create: {
        contadorId,
        nomeEscritorio: 'Escritório Contábil',
        asaasApiKey:    apiKey || null,
      },
    });

    // Auto-registra webhook na conta Asaas
    if (apiKey) {
      const svc = new AsaasService(apiKey);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      if (appUrl) {
        const webhookUrl   = `${appUrl}/api/v1/webhooks/asaas`;
        const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN ?? '';
        await svc.registrarWebhook(webhookUrl, webhookToken);
      }
    }

    logger.info('[PUT /admin/contadores/:id/asaas] Chave salva.', { contadorId });

    return NextResponse.json({
      ok: true,
      configurado: Boolean(apiKey),
      nomeEmpresaAsaas: nomeEmpresa ?? null,
    });
  } catch (err) {
    logger.error('[PUT /admin/contadores/:id/asaas] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
