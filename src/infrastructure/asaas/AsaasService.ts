/**
 * AsaasService — wrapper para a API do Asaas v3.
 */

const BASE_URL =
  process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

// =============================================================================
// Tipos públicos
// =============================================================================

export interface AsaasCliente {
  id:      string;
  name:    string;
  cpfCnpj: string;
}

export interface AsaasPayment {
  id:                string;
  status:            string;
  invoiceUrl:        string | null;
  bankSlipUrl:       string | null;
  nossoNumero:       string | null;
  externalReference: string | null;
  value:             number;
  dueDate:           string;
  billingType:       string;
  subscription:      string | null;
}

export interface AsaasIdentificationField {
  identificationField: string | null;
  nossoNumero:         string | null;
}

export interface AsaasPixQrCode {
  encodedImage:   string | null;
  payload:        string | null;
  expirationDate: string | null;
}

export interface AsaasEstatisticas {
  pendente:   { quantidade: number; valor: number };
  pago:       { quantidade: number; valor: number };
  vencido:    { quantidade: number; valor: number };
  cancelado:  { quantidade: number; valor: number };
  saldo:      number;
}

export interface AsaasAssinatura {
  id:                string;
  status:            string;
  value:             number;
  cycle:             string;
  nextDueDate:       string | null;
  externalReference: string | null;
  description:       string | null;
  customer:          string;
  billingType:       string;
}

export interface CriarBoletoInput {
  customerId:        string;
  valor:             number;
  vencimento:        string;
  descricao?:        string | null;
  externalReference: string;
  billingType?:      'BOLETO' | 'PIX' | 'UNDEFINED';
}

export interface CriarAssinaturaInput {
  customerId:        string;
  valor:             number;
  nextDueDate:       string;
  cycle:             'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  descricao?:        string | null;
  externalReference: string;
  billingType?:      'BOLETO' | 'PIX' | 'UNDEFINED';
}

// =============================================================================
// Serviço
// =============================================================================

export class AsaasService {
  private readonly headers: Record<string, string>;

  constructor(apiKey: string) {
    this.headers = {
      'Content-Type': 'application/json',
      'access_token': apiKey,
    };
  }

  // ---------------------------------------------------------------------------
  // Valida a chave chamando /myAccount
  // ---------------------------------------------------------------------------
  async validarChave(): Promise<{ ok: boolean; nomeEmpresa?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/myAccount`, { headers: this.headers });
      if (!res.ok) return { ok: false };
      const data = await res.json() as { tradingName?: string; name?: string };
      return { ok: true, nomeEmpresa: data.tradingName ?? data.name };
    } catch {
      return { ok: false };
    }
  }

  // ---------------------------------------------------------------------------
  // Registra webhook automaticamente na conta Asaas
  // ---------------------------------------------------------------------------
  async registrarWebhook(webhookUrl: string, token: string): Promise<void> {
    if (token.length < 32) {
      console.warn('[AsaasService] registrarWebhook: ASAAS_WEBHOOK_TOKEN deve ter ≥ 32 chars — webhook não registrado.');
      return;
    }

    try {
      // Busca webhooks existentes para não duplicar
      const lista = await fetch(`${BASE_URL}/webhooks`, { headers: this.headers });
      if (lista.ok) {
        const data = await lista.json() as { data?: { url: string; id: string }[] };
        const existente = data.data?.find((w) => w.url === webhookUrl);
        if (existente) return; // já registrado
      }

      await fetch(`${BASE_URL}/webhooks`, {
        method:  'POST',
        headers: this.headers,
        body: JSON.stringify({
          name:        'Sistema Contábil',
          url:         webhookUrl,
          sendType:    'SEQUENTIALLY',
          enabled:     true,
          interrupted: false,
          authToken:   token,
          events: [
            'PAYMENT_RECEIVED',
            'PAYMENT_CONFIRMED',
            'PAYMENT_OVERDUE',
            'PAYMENT_DELETED',
            'PAYMENT_REFUNDED',
            'PAYMENT_CHARGEBACK_REQUESTED',
            'PAYMENT_CREATED',
            'PAYMENT_REFUND_IN_PROGRESS',
            'PAYMENT_REFUND_DENIED',
            'SUBSCRIPTION_INACTIVATED',
            'SUBSCRIPTION_DELETED',
          ],
        }),
      });
    } catch { /* não bloqueia o fluxo principal */ }
  }

  // ---------------------------------------------------------------------------
  // Busca estatísticas financeiras da conta
  // Nota: o endpoint /finance/payment/statistics aceita apenas PENDING, RECEIVED,
  // CONFIRMED e OVERDUE — CANCELLED não existe nele. Cancelados são contados
  // localmente pelo chamador via DB.
  // ---------------------------------------------------------------------------
  async buscarEstatisticas(): Promise<AsaasEstatisticas> {
    const fetchStats = async (status: string) => {
      try {
        const res = await fetch(
          `${BASE_URL}/finance/payment/statistics?status=${status}`,
          { headers: this.headers },
        );
        if (!res.ok) return { quantity: 0, value: 0 };
        return res.json() as Promise<{ quantity: number; value: number }>;
      } catch { return { quantity: 0, value: 0 }; }
    };

    const [pendente, recebido, confirmado, vencido, saldoRes] = await Promise.all([
      fetchStats('PENDING'),
      fetchStats('RECEIVED'),
      fetchStats('CONFIRMED'),
      fetchStats('OVERDUE'),
      this.buscarSaldo(),
    ]);

    return {
      pendente:  { quantidade: pendente.quantity,                        valor: pendente.value },
      pago:      { quantidade: recebido.quantity + confirmado.quantity,  valor: recebido.value + confirmado.value },
      vencido:   { quantidade: vencido.quantity,                         valor: vencido.value },
      cancelado: { quantidade: 0, valor: 0 }, // preenchido pelo chamador via DB
      saldo: saldoRes,
    };
  }

  // ---------------------------------------------------------------------------
  // Saldo disponível na conta
  // ---------------------------------------------------------------------------
  async buscarSaldo(): Promise<number> {
    try {
      const res = await fetch(`${BASE_URL}/finance/balance`, { headers: this.headers });
      if (!res.ok) return 0;
      const data = await res.json() as { balance: number };
      return data.balance ?? 0;
    } catch { return 0; }
  }

  // ---------------------------------------------------------------------------
  // Busca cliente existente por CPF/CNPJ ou cria um novo
  // ---------------------------------------------------------------------------
  async criarOuBuscarCliente(cpfCnpj: string, nome: string, email?: string): Promise<string> {
    const cnpjLimpo = cpfCnpj.replace(/\D/g, '');

    const busca = await fetch(
      `${BASE_URL}/customers?cpfCnpj=${encodeURIComponent(cnpjLimpo)}&limit=1`,
      { headers: this.headers },
    );
    if (busca.ok) {
      const data = await busca.json() as { data?: AsaasCliente[] };
      if (data.data && data.data.length > 0) return data.data[0].id;
    }

    const criar = await fetch(`${BASE_URL}/customers`, {
      method:  'POST',
      headers: this.headers,
      body: JSON.stringify({
        name:    nome,
        cpfCnpj: cnpjLimpo,
        ...(email ? { email } : {}),
        notificationDisabledUntil: null,
      }),
    });

    if (!criar.ok) {
      const err = await criar.text();
      throw new Error(`Asaas: falha ao criar cliente — ${err}`);
    }

    const cliente = await criar.json() as AsaasCliente;
    return cliente.id;
  }

  // ---------------------------------------------------------------------------
  // Cria cobrança (boleto, PIX ou ambos)
  // ---------------------------------------------------------------------------
  async criarBoleto(input: CriarBoletoInput): Promise<AsaasPayment> {
    const res = await fetch(`${BASE_URL}/payments`, {
      method:  'POST',
      headers: this.headers,
      body: JSON.stringify({
        customer:          input.customerId,
        billingType:       input.billingType ?? 'BOLETO',
        value:             input.valor,
        dueDate:           input.vencimento,
        description:       input.descricao ?? 'Honorários Contábeis',
        externalReference: input.externalReference,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas: falha ao criar boleto — ${err}`);
    }

    return res.json() as Promise<AsaasPayment>;
  }

  // ---------------------------------------------------------------------------
  // Cria assinatura (cobrança recorrente)
  // ---------------------------------------------------------------------------
  async criarAssinatura(input: CriarAssinaturaInput): Promise<AsaasAssinatura> {
    const res = await fetch(`${BASE_URL}/subscriptions`, {
      method:  'POST',
      headers: this.headers,
      body: JSON.stringify({
        customer:          input.customerId,
        billingType:       input.billingType ?? 'BOLETO',
        value:             input.valor,
        nextDueDate:       input.nextDueDate,
        cycle:             input.cycle,
        description:       input.descricao ?? 'Honorários Contábeis',
        externalReference: input.externalReference,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas: falha ao criar assinatura — ${err}`);
    }

    return res.json() as Promise<AsaasAssinatura>;
  }

  // ---------------------------------------------------------------------------
  // Cancela cobranças pendentes de uma assinatura (DELETE /subscriptions não
  // cancela cobranças já geradas — é preciso cancelar cada uma manualmente)
  // ---------------------------------------------------------------------------
  async cancelarCobrancasPendentesAssinatura(subscriptionId: string): Promise<void> {
    try {
      const res = await fetch(
        `${BASE_URL}/payments?subscription=${subscriptionId}&status=PENDING&limit=100`,
        { headers: this.headers },
      );
      if (!res.ok) return;
      const data = await res.json() as { data?: { id: string }[] };
      const payments = data.data ?? [];
      await Promise.all(
        payments.map((p) =>
          fetch(`${BASE_URL}/payments/${p.id}`, {
            method:  'DELETE',
            headers: this.headers,
          }).catch(() => {}),
        ),
      );
    } catch { /* não bloqueia */ }
  }

  // ---------------------------------------------------------------------------
  // Cancela assinatura
  // ---------------------------------------------------------------------------
  async cancelarAssinatura(asaasId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/subscriptions/${asaasId}`, {
      method:  'DELETE',
      headers: this.headers,
    });
    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`Asaas: falha ao cancelar assinatura — ${err}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Lista assinaturas (opcionalmente por cliente)
  // ---------------------------------------------------------------------------
  async listarAssinaturas(customerId?: string): Promise<AsaasAssinatura[]> {
    try {
      const params = customerId ? `?customer=${customerId}` : '';
      const res = await fetch(`${BASE_URL}/subscriptions${params}`, { headers: this.headers });
      if (!res.ok) return [];
      const data = await res.json() as { data?: AsaasAssinatura[] };
      return data.data ?? [];
    } catch { return []; }
  }

  // ---------------------------------------------------------------------------
  // Busca linha digitável (barcode)
  // ---------------------------------------------------------------------------
  async buscarLinhaDigitavel(asaasId: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${BASE_URL}/payments/${asaasId}/identificationField`,
        { headers: this.headers },
      );
      if (!res.ok) return null;
      const data = await res.json() as AsaasIdentificationField;
      return data.identificationField ?? null;
    } catch { return null; }
  }

  // ---------------------------------------------------------------------------
  // Busca QR Code PIX
  // ---------------------------------------------------------------------------
  async buscarPixQrCode(asaasId: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${BASE_URL}/payments/${asaasId}/pixQrCode`,
        { headers: this.headers },
      );
      if (!res.ok) return null;
      const data = await res.json() as AsaasPixQrCode;
      return data.payload ?? null;
    } catch { return null; }
  }

  // ---------------------------------------------------------------------------
  // Cancela cobrança
  // ---------------------------------------------------------------------------
  async cancelarBoleto(asaasId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/payments/${asaasId}`, {
      method:  'DELETE',
      headers: this.headers,
    });
    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`Asaas: falha ao cancelar — ${err}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Estorna pagamento
  // ---------------------------------------------------------------------------
  async estornarPagamento(asaasId: string, valor?: number): Promise<void> {
    const res = await fetch(`${BASE_URL}/payments/${asaasId}/refund`, {
      method:  'POST',
      headers: this.headers,
      body:    JSON.stringify(valor ? { value: valor } : {}),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Asaas: falha ao estornar — ${err}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Consulta status de uma cobrança
  // ---------------------------------------------------------------------------
  async consultarBoleto(asaasId: string): Promise<AsaasPayment | null> {
    try {
      const res = await fetch(`${BASE_URL}/payments/${asaasId}`, { headers: this.headers });
      if (!res.ok) return null;
      return res.json() as Promise<AsaasPayment>;
    } catch { return null; }
  }
}
