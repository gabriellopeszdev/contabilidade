import { logger } from '../di/Container';
import { PDFDocument } from 'pdf-lib';

// =============================================================================
// SignatureApiService — Integração com a SignatureAPI (https://signatureapi.com)
//
// Este serviço encapsula as chamadas REST à API da SignatureAPI para:
//   1. Upload de PDF
//   2. Criação de envelope com signatários
//
// A SignatureAPI retorna um link de cerimônia que o cliente usa para assinar
// diretamente na plataforma, dispensando o fluxo interno de assinatura.
//
// Referência: https://signatureapi.com/docs
// =============================================================================

const BASE_URL = 'https://api.signatureapi.com/v1';

interface CriarAssinaturaResult {
  envelopeId: string;
  linkAssinatura: string;
}

export class SignatureApiService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Retorna true se a API key está configurada (não vazia).
   */
  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Cria uma assinatura na SignatureAPI:
   *   1. Faz upload do PDF
   *   2. Cria o envelope com o signatário configurado
   *   3. Retorna o ID do envelope e o link para cerimônia de assinatura
   *
   * @param fileName        Nome do arquivo PDF
   * @param pdfBuffer       Buffer do PDF a ser assinado
   * @param signatarioNome  Nome completo do signatário
   * @param signatarioEmail E-mail do signatário
   * @param signatarioId    ID interno do signatário (para metadados)
   * @param assinaturaId    ID da AssinaturaDocumento (para rastrear no webhook)
   */
  async criarAssinatura(
    fileName: string,
    pdfBuffer: Buffer,
    signatarioNome: string,
    signatarioEmail: string,
    signatarioId: string,
    assinaturaId: string,
  ): Promise<CriarAssinaturaResult> {
    // -------------------------------------------------------------------------
    // 1. Upload do PDF
    // -------------------------------------------------------------------------
    const uploadResponse = await fetch(`${BASE_URL}/uploads`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
      body: new Uint8Array(pdfBuffer),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => '');
      logger.error('[SignatureAPI] Falha no upload do PDF', {
        status: uploadResponse.status,
        body: errorText,
      });
      throw new Error(`SignatureAPI upload falhou: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadData = await uploadResponse.json() as { id: string; url?: string };
    const uploadId = uploadData.id;
    const uploadUrl = uploadData.url ?? `${BASE_URL}/uploads/${uploadId}`;

    logger.info('[SignatureAPI] PDF enviado com sucesso', { uploadId, fileName });

    // Detectar a quantidade total de páginas para posicionar a assinatura na última página por padrão (fallback)
    let totalPages = 1;
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      totalPages = pdfDoc.getPageCount();
      logger.info('[SignatureAPI] Total de páginas do PDF detectado', { totalPages, fileName });
    } catch (err) {
      logger.warn('[SignatureAPI] Falha ao obter número de páginas do PDF, usando página 1 como fallback', err);
    }

    // -------------------------------------------------------------------------
    // 2. Criar envelope
    //
    // Configuração:
    //   - Autenticação do tipo 'custom' para receber o link de cerimônia
    //     diretamente na resposta (sem depender de e-mail da SignatureAPI)
    //   - Posição fixa no rodapé da primeira página (adequado para PDFs variados)
    //   - Metadados com assinaturaId para rastrear no webhook de volta
    // -------------------------------------------------------------------------
    // Removemos extensões e pontos para evitar o detector de URL no título e mensagem
    const cleanTitle = fileName.replace(/\.[^/.]+$/, "").replace(/\./g, " ");

    const recipientKey = `r_${signatarioId.replace(/-/g, '').slice(0, 30)}`;

    const envelopePayload = {
      title: cleanTitle,
      message: `Por favor, assine o documento "${cleanTitle}".`,
      documents: [
        {
          url: uploadUrl,
          name: fileName,
          places: [
            {
              key: 'assinatura',
              type: 'signature',
              recipient_key: recipientKey,
            },
          ],
          fixed_positions: [
            {
              place_key: 'assinatura',
              page: totalPages,
              top: 700,
              left: 72,
            },
          ],
        },
      ],
      recipients: [
        {
          key: recipientKey,
          type: 'signer',
          name: signatarioNome,
          email: signatarioEmail,
          ceremony: {
            authentication: [
              {
                type: 'custom',
                provider: 'FiscoHub',
                data: {
                  signatarioId,
                  authenticatedAt: new Date().toISOString(),
                },
              },
            ],
          },
        },
      ],
      metadata: {
        assinaturaId,
        signatarioId,
        source: 'fiscohub',
      },
      // Callback URL para receber eventos — configurado via webhook no painel
      // Não precisamos setar aqui, pois será configurado globalmente no dashboard da SignatureAPI
    };

    const envelopeResponse = await fetch(`${BASE_URL}/envelopes`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopePayload),
    });

    if (!envelopeResponse.ok) {
      const errorText = await envelopeResponse.text().catch(() => '');
      logger.error('[SignatureAPI] Falha ao criar envelope', {
        status: envelopeResponse.status,
        body: errorText,
      });
      throw new Error(`SignatureAPI envelope falhou: ${envelopeResponse.status} - ${errorText}`);
    }

    const envelopeData = await envelopeResponse.json() as {
      id: string;
      recipients: Array<{
        ceremony?: {
          url?: string;
        };
        ceremony_url?: string;
        signing_url?: string;
      }>;
    };

    const envelopeId = envelopeData.id;
    // O link de cerimônia pode vir em ceremony.url, ceremony_url ou signing_url dependendo da versão da API
    const linkAssinatura =
      envelopeData.recipients?.[0]?.ceremony?.url ??
      envelopeData.recipients?.[0]?.ceremony_url ??
      envelopeData.recipients?.[0]?.signing_url ??
      '';

    logger.info('[SignatureAPI] Envelope criado com sucesso', {
      envelopeId,
      linkAssinatura: linkAssinatura ? '(presente)' : '(ausente)',
    });

    if (!linkAssinatura) {
      logger.warn('[SignatureAPI] Link de cerimônia não encontrado na resposta', {
        envelopeId,
        responseKeys: Object.keys(envelopeData),
        recipientKeys: envelopeData.recipients?.[0] ? Object.keys(envelopeData.recipients[0]) : [],
      });
    }

    return { envelopeId, linkAssinatura };
  }
}
