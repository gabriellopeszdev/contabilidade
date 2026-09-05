import { XMLParser } from 'fast-xml-parser';

// =============================================================================
// NF-e Parser — Nota Fiscal Eletrônica XML parser
//
// Espelha os campos da consulta pública SEFAZ-BA (NFC-e / NF-e):
//   http://nfe.sefaz.ba.gov.br/servicos/nfce/Modulos/Geral/NFCEC_consulta_abas.aspx
//
// Abas: NF-e, Emitente, Destinatário, Produtos, Totais, Cobrança, Transporte,
//       Informações Adicionais.
//
// Supports both <nfeProc> (authorized NF-e with protocol) and bare <NFe> roots.
// Returns sensible defaults for missing optional fields; only throws when the
// XML has no recognizable NF-e structure at all.
// =============================================================================

export interface NFeEndereco {
  logradouro:      string;
  numero:          string;
  complemento:     string;
  bairro:          string;
  cep:             string;
  codigoMunicipio: string;
  municipio:       string;
  uf:              string;
  codigoPais:      string;
  pais:            string;
  telefone:        string;
}

export interface NFeItemImposto {
  origem:   string;
  cst:      string;
  csosn:    string;
  vBC:      number;
  pICMS:    number;
  vICMS:    number;
  vPIS:     number;
  vCOFINS:  number;
  vIPI:     number;
  vTotTrib: number;
}

export interface NFeParseResult {
  chaveAcesso:         string | null;
  versaoXml:           string;
  numero:              string;
  serie:               string;
  dataEmissao:         string;
  dataSaidaEntrada:    string;
  naturezaOp:          string;
  tipo:                'entrada' | 'saida';
  modelo:              55 | 65 | number;
  ambiente:            1 | 2 | number;
  codigoUF:            number;
  codigoNF:            string;
  codigoMunicipioFG:   string;
  tipoImpressao:       number;
  codigoDV:            string;
  digestValue:         string;
  emitente: {
    cnpj:      string;
    cpf:       string;
    nome:      string;
    nomeFant:  string;
    ie:        string;
    ieSt:      string;
    im:        string;
    cnae:      string;
    crt:       1 | 2 | 3 | 4 | number;
    municipio: string;
    uf:        string;
    telefone:  string;
    endereco:  NFeEndereco;
  };
  destinatario: {
    cnpjOuCpf:   string;
    nome:        string;
    ie:          string;
    im:          string;
    email:       string;
    suframa:     string;
    indicadorIE: number;
    endereco:    NFeEndereco;
  };
  valorTotal: number;
  impostos: {
    icms:                  number;
    pis:                   number;
    cofins:                number;
    ipi:                   number;
    st:                    number;
    frete:                 number;
    desconto:              number;
    baseCalculoIcms:       number;
    icmsDesonerado:        number;
    baseCalculoSt:         number;
    fcp:                   number;
    fcpSt:                 number;
    fcpStRet:              number;
    valorProdutos:         number;
    seguro:                number;
    ii:                    number;
    ipiDevolvido:          number;
    outrasDespesas:        number;
    tributosAproximados:   number;
    icmsUfDest:            number;
    icmsUfRemet:           number;
    fcpUfDest:             number;
    ibs:                   number;
    cbs:                   number;
    is:                    number;
    baseCalculoIbsCbs:     number;
  };
  itens: Array<{
    nItem:              number;
    descricao:          string;
    codigo:             string;
    ean:                string;
    eanTrib:            string;
    ncm:                string;
    cest:               string;
    cfop:               string;
    unidade:            string;
    quantidade:         number;
    valorUnitario:      number;
    valorTotal:         number;
    unidadeTrib:        string;
    quantidadeTrib:     number;
    valorUnitarioTrib:  number;
    valorFrete:         number;
    valorSeguro:        number;
    valorDesconto:      number;
    outrasDespesas:     number;
    infAdProd:          string;
    pedido:             string;
    itemPedido:         string;
    imposto:            NFeItemImposto;
  }>;
  pagamentos: Array<{
    tipo:               string;
    descricao:          string;
    valor:              number;
    indPag:             number;
    bandeira:           string;
    cnpjCredenciadora:  string;
    autorizacao:        string;
  }>;
  troco: number;
  cobranca: {
    fatura: {
      numero:         string;
      valorOriginal:  number;
      valorDesconto:  number;
      valorLiquido:   number;
    } | null;
    duplicatas: Array<{
      numero:     string;
      vencimento: string;
      valor:      number;
    }>;
  };
  protocolo: {
    numero:    string;
    dataHora:  string;
    status:    number;
    motivo:    string;
  } | null;
  qrCode:     string | null;
  urlChave:   string | null;
  idDest:     number;
  indFinal:   number;
  indPres:    number;
  tpEmis:     number;
  finNFe:     number;
  procEmi:    number;
  verProc:    string;
  infCompl:   string;
  infAdic: {
    infCpl:     string;
    infAdFisco: string;
    observacoes: Array<{ campo: string; texto: string }>;
  };
  transporte: {
    modFrete: number;
    transportador: {
      cnpjOuCpf: string;
      nome:      string;
      ie:        string;
      endereco:  string;
      municipio: string;
      uf:        string;
    } | null;
    veiculo: {
      placa: string;
      uf:    string;
      rntc:  string;
    } | null;
    volumes: Array<{
      quantidade:  number;
      especie:     string;
      marca:       string;
      numeracao:   string;
      pesoLiquido: number;
      pesoBruto:   number;
    }>;
  };
  localEntrega:  NFeEndereco | null;
  localRetirada: NFeEndereco | null;
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
  '20': 'Não informado',
  '90': 'Sem Pagamento',
  '99': 'Outros',
};

const BANDEIRAS: Record<string, string> = {
  '01': 'Visa',
  '02': 'Mastercard',
  '03': 'American Express',
  '04': 'Sorocred',
  '05': 'Diners Club',
  '06': 'Elo',
  '07': 'Hipercard',
  '08': 'Aura',
  '09': 'Cabal',
  '99': 'Outros',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

/** SEFAZ costuma emitir urlChave/qrCode sem esquema (`www.sefaz...`). Sem https:// o browser trata como rota do FiscoHub. HTTP vira HTTPS (página HTTPS não carrega iframe/redirect HTTP). */
export function garantirUrlAbsoluta(url: string | null | undefined): string | null {
  if (url == null) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let abs: string;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) abs = trimmed;
  else if (trimmed.startsWith('//')) abs = `https:${trimmed}`;
  else abs = `https://${trimmed.replace(/^\/+/, '')}`;
  try {
    const u = new URL(abs);
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.toString();
  } catch {
    return abs;
  }
}

function toNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toInt(val: unknown): number {
  const n = parseInt(String(val ?? ''), 10);
  return isNaN(n) ? 0 : n;
}

function asArray<T>(val: unknown): T[] {
  if (!val) return [];
  return Array.isArray(val) ? (val as T[]) : [val as T];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function primeiroGrupo(obj: any): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return {};
  const keys = Object.keys(obj).filter((k) => !k.startsWith('@_'));
  if (keys.length === 0) return {};
  const inner = obj[keys[0]];
  return inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : {};
}

function parseEndereco(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ender: any,
): NFeEndereco {
  const e = ender ?? {};
  return {
    logradouro:      toStr(e.xLgr),
    numero:          toStr(e.nro),
    complemento:     toStr(e.xCpl),
    bairro:          toStr(e.xBairro),
    cep:             toStr(e.CEP),
    codigoMunicipio: toStr(e.cMun),
    municipio:       toStr(e.xMun),
    uf:              toStr(e.UF),
    codigoPais:      toStr(e.cPais),
    pais:            toStr(e.xPais) || (toStr(e.cPais) === '1058' ? 'Brasil' : ''),
    telefone:        toStr(e.fone),
  };
}

function parseLocal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  local: any,
): NFeEndereco | null {
  if (!local) return null;
  const end = parseEndereco(local);
  const doc = toStr(local.CNPJ || local.CPF);
  if (!end.logradouro && !end.municipio && !end.uf && !doc) return null;
  return end;
}

function parseItemImposto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imposto: any,
): NFeItemImposto {
  const icmsGrupo = primeiroGrupo(imposto?.ICMS);
  const pisGrupo  = primeiroGrupo(imposto?.PIS);
  const cofGrupo  = primeiroGrupo(imposto?.COFINS);
  const ipi       = imposto?.IPI;
  const ipiGrupo  = (ipi?.IPITrib ?? ipi?.IPINT ?? primeiroGrupo(ipi)) as Record<string, unknown>;

  return {
    origem:   toStr(icmsGrupo.orig),
    cst:      toStr(icmsGrupo.CST),
    csosn:    toStr(icmsGrupo.CSOSN),
    vBC:      toNum(icmsGrupo.vBC),
    pICMS:    toNum(icmsGrupo.pICMS),
    vICMS:    toNum(icmsGrupo.vICMS),
    vPIS:     toNum(pisGrupo.vPIS),
    vCOFINS:  toNum(cofGrupo.vCOFINS),
    vIPI:     toNum(ipiGrupo.vIPI),
    vTotTrib: toNum(imposto?.vTotTrib),
  };
}

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

export function parseNFe(xmlString: string): NFeParseResult {
  const parser = new XMLParser({
    ignoreAttributes:    false,
    attributeNamePrefix: '@_',
    parseTagValue:       false,
    removeNSPrefix:      true,
    isArray: (name) => ['det', 'detPag', 'vol', 'dup', 'reboque', 'NFref', 'obsCont', 'obsFisco'].includes(name),
  });

  const obj = parser.parse(xmlString) as Record<string, unknown>;

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
  const ibsTot: any = infNFe.total?.IBSCBSTot ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isTot: any  = infNFe.total?.ISTot ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ender: any = emit.enderEmit ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supl: any  = nfe?.infNFeSupl ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transp: any = infNFe.transp ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cobr: any   = infNFe.cobr ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infAdic: any = infNFe.infAdic ?? {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const det: any[] = asArray(infNFe.det);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detPag: any[] = asArray(infNFe.pag?.detPag);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infProt: any = root.protNFe?.infProt ?? null;

  const chaveAcesso: string | null =
    toStr(infProt?.chNFe) ||
    toStr((infNFe['@_Id'] as string | undefined)?.replace(/^NFe/, '')) ||
    null;

  const versaoXml =
    toStr(infNFe['@_versao']) ||
    toStr(root['@_versao']) ||
    toStr(nfe['@_versao']) ||
    '4.00';

  const emitEndereco = parseEndereco(ender);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itens = det.map((d: any) => {
    const prod = d.prod ?? {};
    return {
      nItem:             toInt(d['@_nItem']) || 0,
      descricao:         toStr(prod.xProd),
      codigo:            toStr(prod.cProd),
      ean:               toStr(prod.cEAN),
      eanTrib:           toStr(prod.cEANTrib),
      ncm:               toStr(prod.NCM),
      cest:              toStr(prod.CEST),
      cfop:              toStr(prod.CFOP),
      unidade:           toStr(prod.uCom),
      quantidade:        toNum(prod.qCom),
      valorUnitario:     toNum(prod.vUnCom),
      valorTotal:        toNum(prod.vProd),
      unidadeTrib:       toStr(prod.uTrib),
      quantidadeTrib:    toNum(prod.qTrib),
      valorUnitarioTrib: toNum(prod.vUnTrib),
      valorFrete:        toNum(prod.vFrete),
      valorSeguro:       toNum(prod.vSeg),
      valorDesconto:     toNum(prod.vDesc),
      outrasDespesas:    toNum(prod.vOutro),
      infAdProd:         toStr(d.infAdProd),
      pedido:            toStr(prod.xPed),
      itemPedido:        toStr(prod.nItemPed),
      imposto:           parseItemImposto(d.imposto),
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pagamentos = detPag.map((dp: any) => {
    const codigo = toStr(dp.tPag).padStart(2, '0');
    const card   = dp.card ?? {};
    const band   = toStr(card.tBand).padStart(2, '0');
    return {
      tipo:              codigo,
      descricao:         TIPOS_PAGAMENTO[codigo] ?? 'Outros',
      valor:             toNum(dp.vPag),
      indPag:            toInt(dp.indPag),
      bandeira:          band && band !== '00' ? (BANDEIRAS[band] ?? band) : '',
      cnpjCredenciadora: toStr(card.CNPJ),
      autorizacao:       toStr(card.cAut),
    };
  });

  const fat = cobr.fat ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const duplicatas = asArray<any>(cobr.dup).map((d) => ({
    numero:     toStr(d.nDup),
    vencimento: toStr(d.dVenc),
    valor:      toNum(d.vDup),
  }));

  const transporta = transp.transporta ?? null;
  const veicTransp = transp.veicTransp ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumes = asArray<any>(transp.vol).map((v) => ({
    quantidade:  toNum(v.qVol),
    especie:     toStr(v.esp),
    marca:       toStr(v.marca),
    numeracao:   toStr(v.nVol),
    pesoLiquido: toNum(v.pesoL),
    pesoBruto:   toNum(v.pesoB),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observacoes = asArray<any>(infAdic.obsCont).map((o) => ({
    campo: toStr(o['@_xCampo'] ?? o.xCampo),
    texto: toStr(o.xTexto),
  }));

  const infCpl     = toStr(infAdic.infCpl);
  const infAdFisco = toStr(infAdic.infAdFisco);

  const gIBS = ibsTot.gIBS ?? {};
  const gCBS = ibsTot.gCBS ?? {};

  return {
    chaveAcesso:       chaveAcesso || null,
    versaoXml,
    numero:            toStr(ide.nNF),
    serie:             toStr(ide.serie),
    dataEmissao:       toStr(ide.dhEmi || ide.dEmi),
    dataSaidaEntrada:  toStr(ide.dhSaiEnt || ide.dSaiEnt),
    naturezaOp:        toStr(ide.natOp),
    tipo:              toStr(ide.tpNF) === '0' ? 'entrada' : 'saida',
    modelo:            toInt(ide.mod),
    ambiente:          toInt(ide.tpAmb),
    codigoUF:          toInt(ide.cUF),
    codigoNF:          toStr(ide.cNF),
    codigoMunicipioFG: toStr(ide.cMunFG),
    tipoImpressao:     toInt(ide.tpImp),
    codigoDV:          toStr(ide.cDV),
    digestValue:       toStr(infProt?.digVal),
    emitente: {
      cnpj:      toStr(emit.CNPJ),
      cpf:       toStr(emit.CPF),
      nome:      toStr(emit.xNome),
      nomeFant:  toStr(emit.xFant),
      ie:        toStr(emit.IE),
      ieSt:      toStr(emit.IEST),
      im:        toStr(emit.IM),
      cnae:      toStr(emit.CNAE),
      crt:       toInt(emit.CRT),
      municipio: toStr(ender.xMun),
      uf:        toStr(ender.UF),
      telefone:  toStr(ender.fone),
      endereco:  emitEndereco,
    },
    destinatario: {
      cnpjOuCpf:   toStr(dest.CNPJ || dest.CPF),
      nome:        toStr(dest.xNome),
      ie:          toStr(dest.IE),
      im:          toStr(dest.IM),
      email:       toStr(dest.email),
      suframa:     toStr(dest.ISUF),
      indicadorIE: toInt(dest.indIEDest),
      endereco:    parseEndereco(dest.enderDest),
    },
    valorTotal: toNum(total.vNF),
    impostos: {
      icms:                toNum(total.vICMS),
      pis:                 toNum(total.vPIS),
      cofins:              toNum(total.vCOFINS),
      ipi:                 toNum(total.vIPI),
      st:                  toNum(total.vST),
      frete:               toNum(total.vFrete),
      desconto:            toNum(total.vDesc),
      baseCalculoIcms:     toNum(total.vBC),
      icmsDesonerado:      toNum(total.vICMSDeson),
      baseCalculoSt:       toNum(total.vBCST),
      fcp:                 toNum(total.vFCP),
      fcpSt:               toNum(total.vFCPST),
      fcpStRet:            toNum(total.vFCPSTRet),
      valorProdutos:       toNum(total.vProd),
      seguro:              toNum(total.vSeg),
      ii:                  toNum(total.vII),
      ipiDevolvido:        toNum(total.vIPIDevol),
      outrasDespesas:      toNum(total.vOutro),
      tributosAproximados: toNum(total.vTotTrib),
      icmsUfDest:          toNum(total.vICMSUFDest),
      icmsUfRemet:         toNum(total.vICMSUFRemet),
      fcpUfDest:           toNum(total.vFCPUFDest),
      ibs:                 toNum(gIBS.vIBS ?? ibsTot.vIBS),
      cbs:                 toNum(gCBS.vCBS ?? ibsTot.vCBS),
      is:                  toNum(isTot.vIS),
      baseCalculoIbsCbs:   toNum(ibsTot.vBCIBSCBS),
    },
    itens,
    pagamentos,
    troco: toNum(infNFe.pag?.vTroco),
    cobranca: {
      fatura: fat ? {
        numero:        toStr(fat.nFat),
        valorOriginal: toNum(fat.vOrig),
        valorDesconto: toNum(fat.vDesc),
        valorLiquido:  toNum(fat.vLiq),
      } : null,
      duplicatas,
    },
    protocolo: infProt ? {
      numero:   toStr(infProt.nProt),
      dataHora: toStr(infProt.dhRecbto),
      status:   toInt(infProt.cStat),
      motivo:   toStr(infProt.xMotivo),
    } : null,
    qrCode:    garantirUrlAbsoluta(toStr(supl.qrCode)),
    urlChave:  garantirUrlAbsoluta(toStr(supl.urlChave)),
    idDest:    toInt(ide.idDest),
    indFinal:  toInt(ide.indFinal),
    indPres:   toInt(ide.indPres),
    tpEmis:    toInt(ide.tpEmis),
    finNFe:    toInt(ide.finNFe),
    procEmi:   toInt(ide.procEmi),
    verProc:   toStr(ide.verProc),
    infCompl:  infCpl,
    infAdic: {
      infCpl,
      infAdFisco,
      observacoes,
    },
    transporte: {
      modFrete: toInt(transp.modFrete),
      transportador: transporta ? {
        cnpjOuCpf: toStr(transporta.CNPJ || transporta.CPF),
        nome:      toStr(transporta.xNome),
        ie:        toStr(transporta.IE),
        endereco:  toStr(transporta.xEnder),
        municipio: toStr(transporta.xMun),
        uf:        toStr(transporta.UF),
      } : null,
      veiculo: veicTransp ? {
        placa: toStr(veicTransp.placa),
        uf:    toStr(veicTransp.UF),
        rntc:  toStr(veicTransp.RNTC),
      } : null,
      volumes,
    },
    localEntrega:  parseLocal(infNFe.entrega),
    localRetirada: parseLocal(infNFe.retirada),
  };
}
