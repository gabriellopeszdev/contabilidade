import { XMLParser } from 'fast-xml-parser';

// =============================================================================
// NF-e Parser — Nota Fiscal Eletrônica XML parser
//
// Supports both <nfeProc> (authorized NF-e with protocol) and bare <NFe> roots.
// Returns sensible defaults for missing optional fields; only throws when the
// XML has no recognizable NF-e structure at all.
// =============================================================================

export interface NFeParseResult {
  chaveAcesso:  string | null;
  numero:       string;
  serie:        string;
  dataEmissao:  string;
  naturezaOp:   string;
  tipo:         'entrada' | 'saida';
  modelo:       55 | 65 | number; // 55 = NF-e, 65 = NFC-e
  ambiente:     1 | 2 | number;   // 1 = produção, 2 = homologação
  emitente: {
    cnpj:      string;
    nome:      string;
    nomeFant:  string;
    ie:        string;
    crt:       1 | 2 | 3 | 4 | number; // 1=Simples, 2=Simples Excesso, 3=Normal, 4=MEI
    municipio: string;
    uf:        string;
    telefone:  string;
    endereco:  {
      logradouro: string;
      numero:     string;
      bairro:     string;
      cep:        string;
    };
  };
  destinatario: {
    cnpjOuCpf: string;
    nome:      string;
  };
  valorTotal: number;
  impostos: {
    icms:     number;
    pis:      number;
    cofins:   number;
    ipi:      number;
    st:       number;
    frete:    number;
    desconto: number;
  };
  itens: Array<{
    descricao:     string;
    codigo:        string;
    ncm:           string;
    cfop:          string;
    quantidade:    number;
    valorUnitario: number;
    valorTotal:    number;
  }>;
  pagamentos: Array<{ tipo: string; descricao: string; valor: number }>;
  protocolo: {
    numero:    string;
    dataHora:  string;
    status:    number;
    motivo:    string;
  } | null;
  qrCode: string | null;
}

// ---------------------------------------------------------------------------
// Tabela de tipos de pagamento (tPag)
// ---------------------------------------------------------------------------

const TIPOS_PAGAMENTO: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'PIX',
  '18': 'Transferência Bancária',
  '19': 'Cashback',
  '90': 'Sem Pagamento',
  '99': 'Outros',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function toNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toInt(val: unknown): number {
  const n = parseInt(String(val ?? ''), 10);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

export function parseNFe(xmlString: string): NFeParseResult {
  const parser = new XMLParser({
    ignoreAttributes:    false,
    attributeNamePrefix: '@_',
    parseTagValue:       false, // mantém string; toNum() converte explicitamente (evita float em chave de 44 dígitos)
    removeNSPrefix:      true,
    isArray: (name) => ['det', 'detPag'].includes(name),
  });

  const obj = parser.parse(xmlString) as Record<string, unknown>;

  // Resolve root — handle <nfeProc> wrapper or bare <NFe>
  const rootKey = Object.keys(obj).find(
    (k) => k === 'nfeProc' || k === 'NFe' || k.endsWith(':nfeProc') || k.endsWith(':NFe'),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = (rootKey ? (obj[rootKey] as any) : null) as any;

  if (!root) {
    throw new Error('XML não reconhecido como NF-e: nenhum elemento <nfeProc> ou <NFe> encontrado.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nfe: any    = root.NFe ?? root;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infNFe: any = nfe?.infNFe;

  if (!infNFe) {
    throw new Error('XML não reconhecido como NF-e: elemento <infNFe> ausente.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ide: any   = infNFe.ide   ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emit: any  = infNFe.emit  ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dest: any  = infNFe.dest  ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total: any = infNFe.total?.ICMSTot ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ender: any = emit.enderEmit ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supl: any  = nfe?.infNFeSupl ?? {};

  const det: any[] = Array.isArray(infNFe.det) ? infNFe.det : (infNFe.det ? [infNFe.det] : []); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Pagamentos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detPag: any[] = (() => {
    const pag = infNFe.pag;
    if (!pag) return [];
    const dp = pag.detPag;
    if (!dp) return [];
    return Array.isArray(dp) ? dp : [dp];
  })();

  // Protocolo de autorização
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infProt: any = root.protNFe?.infProt ?? null;

  // Chave de acesso
  const chaveAcesso: string | null =
    toStr(infProt?.chNFe) ||
    toStr((infNFe['@_Id'] as string | undefined)?.replace(/^NFe/, '')) ||
    null;

  // Itens
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itens = det.map((d: any) => ({
    descricao:     toStr(d.prod?.xProd),
    codigo:        toStr(d.prod?.cProd),
    ncm:           toStr(d.prod?.NCM),
    cfop:          toStr(d.prod?.CFOP),
    quantidade:    toNum(d.prod?.qCom),
    valorUnitario: toNum(d.prod?.vUnCom),
    valorTotal:    toNum(d.prod?.vProd),
  }));

  // Pagamentos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pagamentos = detPag.map((dp: any) => {
    const codigo = toStr(dp.tPag).padStart(2, '0');
    return {
      tipo:      codigo,
      descricao: TIPOS_PAGAMENTO[codigo] ?? 'Outros',
      valor:     toNum(dp.vPag),
    };
  });

  return {
    chaveAcesso: chaveAcesso || null,
    numero:      toStr(ide.nNF),
    serie:       toStr(ide.serie),
    dataEmissao: toStr(ide.dhEmi || ide.dEmi),
    naturezaOp:  toStr(ide.natOp),
    tipo:        toStr(ide.tpNF) === '0' ? 'entrada' : 'saida',
    modelo:      toInt(ide.mod),
    ambiente:    toInt(ide.tpAmb),
    emitente: {
      cnpj:     toStr(emit.CNPJ),
      nome:     toStr(emit.xNome),
      nomeFant: toStr(emit.xFant),
      ie:       toStr(emit.IE),
      crt:      toInt(emit.CRT),
      municipio: toStr(ender.xMun),
      uf:       toStr(ender.UF),
      telefone: toStr(ender.fone),
      endereco: {
        logradouro: toStr(ender.xLgr),
        numero:     toStr(ender.nro),
        bairro:     toStr(ender.xBairro),
        cep:        toStr(ender.CEP),
      },
    },
    destinatario: {
      cnpjOuCpf: toStr(dest.CNPJ || dest.CPF),
      nome:      toStr(dest.xNome),
    },
    valorTotal: toNum(total.vNF),
    impostos: {
      icms:     toNum(total.vICMS),
      pis:      toNum(total.vPIS),
      cofins:   toNum(total.vCOFINS),
      ipi:      toNum(total.vIPI),
      st:       toNum(total.vST),
      frete:    toNum(total.vFrete),
      desconto: toNum(total.vDesc),
    },
    itens,
    pagamentos,
    protocolo: infProt ? {
      numero:   toStr(infProt.nProt),
      dataHora: toStr(infProt.dhRecbto),
      status:   toInt(infProt.cStat),
      motivo:   toStr(infProt.xMotivo),
    } : null,
    qrCode: toStr(supl.qrCode) || null,
  };
}
