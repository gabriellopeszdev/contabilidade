import { XMLParser } from 'fast-xml-parser';

export interface NFeMetadata {
  chaveAcesso?:    string;
  numero?:         string;
  serie?:          string;
  dataEmissao?:    string;
  naturezaOp?:     string;
  cfop?:           string;
  valorTotal?:     number;
  emitenteCnpj?:   string;
  emitenteNome?:   string;
  emitenteUf?:     string;
  destinatarioCnpj?: string;
  destinatarioNome?: string;
  totalItens?:     number;
  descricaoPrincipal?: string;
  valorIcms?:      number;
  valorPis?:       number;
  valorCofins?:    number;
  valorIss?:       number;
  tipoNfe?:        'NFe' | 'NFCe' | 'NFSe' | 'CTe' | 'outro';
}

export function parseNFe(xmlString: string): NFeMetadata | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes:    false,
      attributeNamePrefix: '@_',
      parseTagValue:       true,
    });
    const obj = parser.parse(xmlString);

    const nfeProc = obj.nfeProc ?? obj.NFe ?? obj.nfeProc;
    const nfe     = nfeProc?.NFe ?? obj.NFe;
    const infNFe  = nfe?.infNFe;

    if (!infNFe) {
      return { tipoNfe: 'NFSe' };
    }

    const ide  = infNFe.ide  ?? {};
    const emit = infNFe.emit ?? {};
    const dest = infNFe.dest ?? {};
    const total = infNFe.total?.ICMSTot ?? {};
    const det  = Array.isArray(infNFe.det) ? infNFe.det : (infNFe.det ? [infNFe.det] : []);

    const chave = infNFe['@_Id']?.replace(/^NFe/, '') ?? '';

    return {
      chaveAcesso:       chave || undefined,
      numero:            String(ide.nNF ?? ''),
      serie:             String(ide.serie ?? ''),
      dataEmissao:       ide.dhEmi ?? ide.dEmi,
      naturezaOp:        ide.natOp,
      cfop:              det[0]?.prod?.CFOP ? String(det[0].prod.CFOP) : undefined,
      valorTotal:        Number(total.vNF ?? 0) || undefined,
      emitenteCnpj:      emit.CNPJ,
      emitenteNome:      emit.xNome ?? emit.xFant,
      emitenteUf:        emit.enderEmit?.UF,
      destinatarioCnpj:  dest.CNPJ ?? dest.CPF,
      destinatarioNome:  dest.xNome,
      totalItens:        det.length,
      descricaoPrincipal: det[0]?.prod?.xProd,
      valorIcms:         Number(total.vICMS ?? 0) || undefined,
      valorPis:          Number(total.vPIS  ?? 0) || undefined,
      valorCofins:       Number(total.vCOFINS ?? 0) || undefined,
      tipoNfe:           'NFe',
    };
  } catch {
    return null;
  }
}
