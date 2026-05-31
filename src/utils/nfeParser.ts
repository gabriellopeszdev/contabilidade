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
  dataEmissao:  string; // ISO date string
  naturezaOp:   string;
  tipo:         'entrada' | 'saida';
  emitente: {
    cnpj:      string;
    nome:      string;
    municipio: string;
    uf:        string;
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
    desconto: number;
  };
  itens: Array<{ descricao: string; quantidade: number; valorUnitario: number }>;
}

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

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

export function parseNFe(xmlString: string): NFeParseResult {
  const parser = new XMLParser({
    ignoreAttributes:    false,
    attributeNamePrefix: '@_',
    parseTagValue:       true,
    isArray: (name) => ['det'].includes(name),
  });

  const obj = parser.parse(xmlString) as Record<string, unknown>;

  // Resolve root — handle <nfeProc> wrapper or bare <NFe>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = (obj.nfeProc ?? obj.NFe ?? null) as any;

  if (!root) {
    throw new Error('XML não reconhecido como NF-e: nenhum elemento <nfeProc> ou <NFe> encontrado.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nfe: any = root.NFe ?? root;
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

  // det is forced to array by isArray option
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const det: any[] = Array.isArray(infNFe.det) ? infNFe.det : (infNFe.det ? [infNFe.det] : []);

  // Chave de acesso: from <protNFe> or from @_Id attribute on infNFe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prot: any     = root.protNFe?.infProt ?? null;
  const chaveAcesso: string | null =
    toStr(prot?.chNFe) ||
    toStr((infNFe['@_Id'] as string | undefined)?.replace(/^NFe/, '')) ||
    null;

  // tpNF: 0 = entrada, 1 = saída
  const tipo: 'entrada' | 'saida' = toStr(ide.tpNF) === '0' ? 'entrada' : 'saida';

  // enderEmit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ender: any = emit.enderEmit ?? {};

  // Items
  const itens = det.map((d) => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descricao:     toStr((d as any).prod?.xProd),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quantidade:    toNum((d as any).prod?.qCom),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valorUnitario: toNum((d as any).prod?.vUnCom),
  }));

  return {
    chaveAcesso: chaveAcesso || null,
    numero:      toStr(ide.nNF),
    serie:       toStr(ide.serie),
    dataEmissao: toStr(ide.dhEmi || ide.dEmi),
    naturezaOp:  toStr(ide.natOp),
    tipo,
    emitente: {
      cnpj:      toStr(emit.CNPJ),
      nome:      toStr(emit.xNome || emit.xFant),
      municipio: toStr(ender.xMun),
      uf:        toStr(ender.UF),
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
      desconto: toNum(total.vDesc),
    },
    itens,
  };
}
