import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';
import { encrypt } from '../../../../../../src/utils/encryption';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PUT /api/v1/escritorio/integracao/cora
//
// Salva (ou remove) as credenciais mTLS da Cora do contador logado.
//
// Body: { coraClientId, coraCertificatePem, coraPrivateKeyPem }
//       — todos vazios ("") remove a integração
// =============================================================================

export const PUT = withAuth(async (req, _ctx, auth) => {
  try {
    const body = await req.json() as {
      coraClientId?:      string;
      coraCertificatePem?: string;
      coraPrivateKeyPem?:  string;
    };

    const clientId  = (body.coraClientId      ?? '').trim();
    const certPem   = (body.coraCertificatePem ?? '').trim();
    const privKey   = (body.coraPrivateKeyPem  ?? '').trim();

    const removendo = !clientId && !certPem && !privKey;

    // Ao ativar Cora, remove Asaas (apenas uma integração de boleto por vez)
    await prisma.configuracaoEscritorio.upsert({
      where:  { contadorId: auth.sub },
      update: {
        coraClientId:       clientId || null,
        coraCertificatePem: certPem  ? encrypt(certPem)  : null,
        coraPrivateKeyPem:  privKey  ? encrypt(privKey)  : null,
        ...(!removendo ? { asaasApiKey: null } : {}),
      },
      create: {
        contadorId:         auth.sub,
        nomeEscritorio:     'Escritório Contábil',
        coraClientId:       clientId || null,
        coraCertificatePem: certPem  ? encrypt(certPem)  : null,
        coraPrivateKeyPem:  privKey  ? encrypt(privKey)  : null,
      },
    });

    logger.info('[PUT /escritorio/integracao/cora] Integração Cora atualizada.', { contadorId: auth.sub, removendo });

    return NextResponse.json({ ok: true, configurado: !removendo });
  } catch (err) {
    logger.error('[PUT /escritorio/integracao/cora] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
