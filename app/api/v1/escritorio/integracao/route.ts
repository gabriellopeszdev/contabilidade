import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';
import { AsaasService } from '@/infrastructure/asaas/AsaasService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/escritorio/integracao — Status das integrações configuradas
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const config = await prisma.configuracaoEscritorio.findUnique({
      where:  { contadorId: auth.sub },
      select: { asaasApiKey: true, coraClientId: true },
    });

    return NextResponse.json({
      asaas: {
        configurado:  Boolean(config?.asaasApiKey),
      },
      cora: {
        configurado:  Boolean(config?.coraClientId),
        clientId:     config?.coraClientId ?? null,
      },
    });
  } catch (err) {
    logger.error('[GET /escritorio/integracao] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);

// =============================================================================
// PUT /api/v1/escritorio/integracao
//
// Salva (ou remove) a chave Asaas do próprio contador logado.
// Valida a chave antes de persistir e registra o webhook automaticamente.
//
// Body: { asaasApiKey: string }  — vazio ("") remove a chave
// =============================================================================

export const PUT = withAuth(async (req, _ctx, auth) => {
  try {
    const body = await req.json() as { asaasApiKey?: string };
    const apiKey = (body.asaasApiKey ?? '').trim();

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

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      if (appUrl) {
        const webhookUrl   = `${appUrl}/api/v1/webhooks/asaas`;
        const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN ?? '';
        await svc.registrarWebhook(webhookUrl, webhookToken);
      }
    }

    // Ao ativar Asaas, remove Cora (apenas uma integração de boleto por vez)
    await prisma.configuracaoEscritorio.upsert({
      where:  { contadorId: auth.sub },
      update: {
        asaasApiKey:       apiKey || null,
        ...(apiKey ? { coraClientId: null, coraCertificatePem: null, coraPrivateKeyPem: null } : {}),
      },
      create: {
        contadorId:    auth.sub,
        nomeEscritorio: 'Escritório Contábil',
        asaasApiKey:   apiKey || null,
      },
    });

    logger.info('[PUT /escritorio/integracao] Integração Asaas atualizada.', { contadorId: auth.sub });

    return NextResponse.json({
      ok:               true,
      configurado:      Boolean(apiKey),
      nomeEmpresaAsaas: nomeEmpresa ?? null,
    });
  } catch (err) {
    logger.error('[PUT /escritorio/integracao] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
