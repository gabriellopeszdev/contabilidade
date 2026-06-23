/**
 * CoraService — wrapper para a API v2 do Banco Cora.
 *
 * AUTENTICAÇÃO: OAuth 2.0 Client Credentials com mTLS obrigatório.
 *   - O contador precisa ter um certificado TLS emitido pelo Cora e a chave privada.
 *   - Todas as requests (token e invoices) passam o cert + key para autenticação mútua.
 *   - O access_token tem validade de 24h e é cacheado em memória por instância.
 *
 * VALORES: A Cora representa valores em centavos (inteiros).
 *   Ex: R$ 250,00 → 25000
 *
 * REFERÊNCIA: https://developers.cora.com.br/reference/emiss%C3%A3o-de-boleto-registrado-v2
 */

import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { decrypt, isEncrypted } from '../../utils/encryption';

// =============================================================================
// Configuração de ambiente
// =============================================================================

const IS_PROD = process.env.CORA_ENV === 'production';

const BASE_URL_MTLS = IS_PROD
  ? 'https://matls-clients.api.cora.com.br'
  : 'https://matls-clients.api.stage.cora.com.br';

// =============================================================================
// Tipos públicos
// =============================================================================

export interface CoraInvoice {
  id:           string;
  status:       string;
  code:         string;
  barcode:      string | null;
  boleto_url:   string | null;
  pix:          { qr_code: string | null } | null;
}

export interface CriarCoraInvoiceInput {
  clienteNome:       string;
  clienteCnpjCpf:    string;
  clienteEmail:      string;
  valor:             number; // em reais (ex: 250.00)
  vencimento:        string; // YYYY-MM-DD
  descricao:         string;
  externalReference: string; // ID interno (uuid do boleto)
  comPix?:           boolean;
}

// =============================================================================
// Helper: executa request HTTPS com certificado de cliente (mTLS)
// =============================================================================

function mTLSFetch(opts: {
  url:     string;
  method:  string;
  headers: Record<string, string>;
  body?:   string;
  cert:    string;
  key:     string;
}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(opts.url);

    const req = https.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port ? parseInt(parsed.port) : 443,
        path:     parsed.pathname + parsed.search,
        method:   opts.method,
        headers:  opts.headers,
        cert:     opts.cert,
        key:      opts.key,
        rejectUnauthorized: true,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: data }));
      },
    );

    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// =============================================================================
// CoraService
// =============================================================================

export class CoraService {
  private cachedToken: string | null = null;
  private tokenExpiresAt: number     = 0;

  constructor(
    private readonly clientId:       string,
    private readonly certificatePem: string,
    private readonly privateKeyPem:  string,
  ) {
    // Suporte a migração gradual: decifra se o valor estiver cifrado, mantém em
    // texto claro se for um PEM legado ainda não migrado.
    const rawCert = certificatePem;
    const rawKey  = privateKeyPem;
    this.certificatePem = isEncrypted(rawCert) ? decrypt(rawCert) : rawCert;
    this.privateKeyPem  = isEncrypted(rawKey)  ? decrypt(rawKey)  : rawKey;
  }

  // ---------------------------------------------------------------------------
  // Obtém (ou reutiliza) access token via Client Credentials
  // ---------------------------------------------------------------------------
  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const res = await mTLSFetch({
      url:    `${BASE_URL_MTLS}/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body:   `grant_type=client_credentials&client_id=${encodeURIComponent(this.clientId)}`,
      cert:   this.certificatePem,
      key:    this.privateKeyPem,
    });

    if (res.status !== 200) {
      throw new Error(`Cora: falha ao obter token (HTTP ${res.status}) — ${res.text}`);
    }

    const json = JSON.parse(res.text) as {
      access_token: string;
      expires_in:   number;
    };

    this.cachedToken    = json.access_token;
    // Desconta 60s para renovar antes de expirar
    this.tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000;

    return this.cachedToken;
  }

  // ---------------------------------------------------------------------------
  // Valida as credenciais (tenta obter um token)
  // ---------------------------------------------------------------------------
  async validarCredenciais(): Promise<{ ok: boolean; erro?: string }> {
    try {
      await this.getAccessToken();
      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err instanceof Error ? err.message : String(err) };
    }
  }

  // ---------------------------------------------------------------------------
  // Cria invoice (boleto registrado) na Cora
  // ---------------------------------------------------------------------------
  async criarInvoice(input: CriarCoraInvoiceInput): Promise<CoraInvoice> {
    const token = await this.getAccessToken();

    const valorCentavos = Math.round(input.valor * 100);
    const paymentForms  = input.comPix ? ['BANK_SLIP', 'PIX'] : ['BANK_SLIP'];

    const body = JSON.stringify({
      code:     input.externalReference,
      customer: {
        name:     input.clienteNome,
        cnpj_cpf: input.clienteCnpjCpf.replace(/\D/g, ''),
        email:    input.clienteEmail,
      },
      services: [
        {
          name:        input.descricao,
          description: input.descricao,
          amount:      valorCentavos,
        },
      ],
      payment_terms: {
        due_date: input.vencimento,
      },
      payment_forms: paymentForms,
    });

    const res = await mTLSFetch({
      url:    `${BASE_URL_MTLS}/v2/invoices/`,
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${token}`,
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body,
      cert: this.certificatePem,
      key:  this.privateKeyPem,
    });

    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Cora: falha ao criar invoice (HTTP ${res.status}) — ${res.text}`);
    }

    return JSON.parse(res.text) as CoraInvoice;
  }

  // ---------------------------------------------------------------------------
  // Consulta invoice por ID
  // ---------------------------------------------------------------------------
  async consultarInvoice(coraId: string): Promise<CoraInvoice | null> {
    try {
      const token = await this.getAccessToken();

      const res = await mTLSFetch({
        url:    `${BASE_URL_MTLS}/v2/invoices/${coraId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept':        'application/json',
        },
        cert: this.certificatePem,
        key:  this.privateKeyPem,
      });

      if (res.status === 404) return null;
      if (res.status !== 200) return null;

      return JSON.parse(res.text) as CoraInvoice;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Cancela invoice
  // ---------------------------------------------------------------------------
  async cancelarInvoice(coraId: string): Promise<void> {
    const token = await this.getAccessToken();

    const res = await mTLSFetch({
      url:    `${BASE_URL_MTLS}/v2/invoices/${coraId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/json',
      },
      cert: this.certificatePem,
      key:  this.privateKeyPem,
    });

    if (res.status !== 200 && res.status !== 204 && res.status !== 404) {
      throw new Error(`Cora: falha ao cancelar invoice (HTTP ${res.status}) — ${res.text}`);
    }
  }
}
