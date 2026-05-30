// =============================================================================
// DocSealService — cliente para a API REST do DocSeal (self-hosted)
//
// DocSeal é uma plataforma open-source de assinatura eletrônica.
// Esta classe encapsula todas as chamadas à API; o resto do sistema
// só interage com os tipos exportados aqui.
//
// Configuração (via env):
//   DOCSEAL_API_URL  — URL interna do container DocSeal, ex: http://docseal:3000
//   DOCSEAL_API_KEY  — chave obtida no painel DocSeal em /api
// =============================================================================

export interface DocSealSubmitter {
  id:        number;
  uuid:      string;
  email:     string;
  name:      string;
  status:    string;
  embed_src: string;  // URL de assinatura para enviar ao signatário
  slug:      string;
}

export interface DocSealSubmission {
  id:         number;
  status:     string;
  slug:       string;
  submitters: DocSealSubmitter[];
}

export class DocSealService {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey:  string,
  ) {}

  /** Retorna true se a integração com DocSeal está configurada. */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Cria uma solicitação de assinatura no DocSeal com upload direto de PDF.
   *
   * @param fileName      Nome original do arquivo (ex: "DARF_Abril_2026.pdf")
   * @param pdfBase64     Conteúdo do PDF codificado em base64
   * @param signatarioNome  Nome completo do signatário
   * @param signatarioEmail E-mail do signatário
   * @returns Objeto com submissionId e o link de assinatura (embed_src)
   */
  async criarSubmissao(
    fileName:        string,
    pdfBase64:       string,
    signatarioNome:  string,
    signatarioEmail: string,
  ): Promise<{ submissionId: number; linkAssinatura: string }> {
    const res = await fetch(`${this.baseUrl}/api/submissions/pdf`, {
      method:  'POST',
      headers: {
        'X-Auth-Token': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Assinatura — ${fileName}`,
        documents: [
          {
            name: fileName,
            file: pdfBase64,
            fields: [
              {
                name:     'Assinatura',
                role:     'Signatário',
                type:     'signature',
                required: true,
                areas:    [{ x: 0.05, y: 0.80, w: 0.50, h: 0.10, page: -1 }],
              },
            ],
          },
        ],
        submitters: [
          {
            name:       signatarioNome,
            email:      signatarioEmail,
            role:       'Signatário',
            send_email: false,  // e-mail gerenciado pelo sistema contábil
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DocSeal API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as DocSealSubmission;
    const submitter = data.submitters[0];

    if (!submitter?.embed_src) {
      throw new Error('DocSeal não retornou embed_src para o submitter');
    }

    return {
      submissionId:   data.id,
      linkAssinatura: submitter.embed_src,
    };
  }
}
