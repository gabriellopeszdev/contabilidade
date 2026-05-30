// =============================================================================
// DocSealService — cliente para a API REST do DocSeal (self-hosted)
//
// Fluxo community edition (2 etapas):
//   1. POST /api/templates  (multipart/form-data) → cria template com o PDF
//   2. POST /api/submissions → cria submission a partir do template
//
// Nota: os endpoints /api/templates/pdf e /api/submissions/pdf (JSON + base64)
// são exclusivos da edição Pro paga. A community edition requer multipart.
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
  embed_src: string;
  slug:      string;
}

export interface DocSealSubmission {
  id:         number;
  status:     string;
  slug:       string;
  submitters: DocSealSubmitter[];
}

interface DocSealTemplate {
  id:   number;
  name: string;
  slug: string;
}

export class DocSealService {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey:  string,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async criarSubmissao(
    fileName:        string,
    pdfBase64:       string,
    signatarioNome:  string,
    signatarioEmail: string,
  ): Promise<{ submissionId: number; linkAssinatura: string }> {
    const templateId = await this.criarTemplate(fileName, pdfBase64);
    return this.criarSubmissaoDeTemplate(templateId, signatarioNome, signatarioEmail);
  }

  // ---------------------------------------------------------------------------
  // Etapa 1: cria template via multipart (community edition)
  // ---------------------------------------------------------------------------
  private async criarTemplate(fileName: string, pdfBase64: string): Promise<number> {
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const blob      = new Blob([pdfBuffer], { type: 'application/pdf' });

    const form = new FormData();
    form.append('name', `Assinatura — ${fileName}`);
    form.append('documents[][name]', fileName);
    form.append('documents[][file]', blob, fileName);

    const res = await fetch(`${this.baseUrl}/api/templates`, {
      method:  'POST',
      headers: { 'X-Auth-Token': this.apiKey },
      body:    form,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DocSeal template error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as DocSealTemplate;
    return data.id;
  }

  // ---------------------------------------------------------------------------
  // Etapa 2: cria submission a partir do template
  // ---------------------------------------------------------------------------
  private async criarSubmissaoDeTemplate(
    templateId:      number,
    signatarioNome:  string,
    signatarioEmail: string,
  ): Promise<{ submissionId: number; linkAssinatura: string }> {
    const res = await fetch(`${this.baseUrl}/api/submissions`, {
      method:  'POST',
      headers: {
        'X-Auth-Token': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        send_email:  false,
        submitters: [
          {
            name:  signatarioNome,
            email: signatarioEmail,
            role:  'First Party',
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DocSeal submission error ${res.status}: ${body}`);
    }

    const data      = (await res.json()) as DocSealSubmission[];
    const submission = data[0];
    const submitter  = submission?.submitters?.[0];

    if (!submitter?.embed_src) {
      throw new Error('DocSeal não retornou embed_src para o submitter');
    }

    return {
      submissionId:   submission.id,
      linkAssinatura: submitter.embed_src,
    };
  }
}
