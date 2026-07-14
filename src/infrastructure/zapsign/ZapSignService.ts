import { logger } from '../di/Container';

// =============================================================================
// ZapSignService — Integração com a ZapSign (https://zapsign.com.br)
//
// Encapsula as chamadas REST à API da ZapSign para:
//   1. Criar documento com signatário
//   2. Excluir documento (cancelamento)
//   3. Reenviar notificação em massa
//   4. Detalhar documento (reconciliação manual)
//
// Autenticação: Bearer token no header Authorization.
// Referência: https://zapsign.com.br/api/docs
// =============================================================================

const BASE_URL = 'https://api.zapsign.com.br/api/v1';

interface CriarAssinaturaResult {
  docToken:      string;
  linkAssinatura: string;
}

export class ZapSignService {
  private readonly apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  isConfigured(): boolean {
    return this.apiToken.length > 0;
  }

  async criarAssinatura(
    fileName: string,
    pdfBase64: string,
    signatarioNome: string,
    signatarioEmail: string,
    assinaturaId: string,
  ): Promise<CriarAssinaturaResult> {
    const body = {
      name:        fileName,
      base64_pdf:  pdfBase64,
      external_id: assinaturaId,
      lang:        'pt-br',
      signers: [
        {
          name:                    signatarioNome,
          email:                   signatarioEmail,
          phone_country:           '55',
          phone_number:            '',
          auth_mode:               'assinaturaTela-tokenEmail',
          send_automatic_email:    false,
          send_automatic_whatsapp: false,
        },
      ],
    };

    const res = await fetch(`${BASE_URL}/docs/`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      logger.error('[ZapSign] Falha ao criar documento', { status: res.status, body: errorText });
      throw new Error(`ZapSign criarAssinatura falhou: ${res.status} - ${errorText}`);
    }

    const data = await res.json() as {
      token:   string;
      signers: Array<{ sign_url: string }>;
    };

    const docToken      = data.token;
    const linkAssinatura = data.signers?.[0]?.sign_url ?? '';

    logger.info('[ZapSign] Documento criado com sucesso', {
      docToken,
      linkAssinatura: linkAssinatura ? '(presente)' : '(ausente)',
    });

    if (!linkAssinatura) {
      logger.warn('[ZapSign] sign_url não encontrado na resposta', { docToken });
    }

    return { docToken, linkAssinatura };
  }

  async excluirDocumento(docToken: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/docs/${docToken}/`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      logger.warn('[ZapSign] Falha ao excluir documento', { docToken, status: res.status, body: errorText });
      throw new Error(`ZapSign excluirDocumento falhou: ${res.status} - ${errorText}`);
    }

    logger.info('[ZapSign] Documento excluído', { docToken });
  }

  async reenviarNotificacao(docToken: string): Promise<{ sentCount: number; failedCount: number }> {
    const res = await fetch(`${BASE_URL}/docs/${docToken}/resend-notifications-bulk/`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      logger.warn('[ZapSign] Falha ao reenviar notificação', { docToken, status: res.status, body: errorText });
      throw new Error(`ZapSign reenviarNotificacao falhou: ${res.status} - ${errorText}`);
    }

    const data = await res.json() as { sent_count: number; failed_count: number };
    logger.info('[ZapSign] Notificações reenviadas', {
      docToken,
      sentCount:   data.sent_count,
      failedCount: data.failed_count,
    });

    return { sentCount: data.sent_count, failedCount: data.failed_count };
  }

  async detalharDocumento(docToken: string): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/docs/${docToken}/`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      logger.warn('[ZapSign] Falha ao detalhar documento', { docToken, status: res.status, body: errorText });
      throw new Error(`ZapSign detalharDocumento falhou: ${res.status} - ${errorText}`);
    }

    return res.json();
  }
}
