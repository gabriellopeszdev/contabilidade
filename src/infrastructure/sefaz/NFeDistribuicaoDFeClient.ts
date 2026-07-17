import * as https   from 'node:https';
import * as zlib    from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

// =============================================================================
// NFeDistribuicaoDFe Client
//
// Webservice nacional da SEFAZ que retorna todos os XMLs de NF-e destinados
// a um CNPJ, independente do estado emissor.
//
// Produção:    https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
// Homologação: https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx
//
// Autenticação: mTLS com certificado A1 (.pfx) do destinatário.
// =============================================================================

const URLS = {
  producao:    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
};

export interface DocumentoSefaz {
  xml:     string;   // XML completo (procNFe/nfeProc)
  chave:   string;   // chave de acesso (44 dígitos)
  nsu:     string;   // NSU do documento
  schema:  string;   // ex: "procNFe_v4.00.xsd"
}

export interface ResultadoConsulta {
  documentos: DocumentoSefaz[];
  maxNSU:     string;   // último NSU disponível na SEFAZ
  ultNSU:     string;   // último NSU retornado neste lote
}

export class NFeDistribuicaoDFeClient {
  private readonly url: string;

  constructor(private readonly ambiente: 'producao' | 'homologacao' = 'producao') {
    this.url = URLS[ambiente];
  }

  /**
   * Consulta a SEFAZ a partir do ultimoNsu salvo.
   *
   * @param cnpj       CNPJ do destinatário (14 dígitos, sem formatação)
   * @param ultimoNsu  Cursor da última consulta (15 dígitos com zeros à esquerda)
   * @param pfxBuffer  Buffer do arquivo .pfx decifrado
   * @param pfxSenha   Senha do .pfx decifrado
   */
  async consultarDistribuicao(
    cnpj:      string,
    ultimoNsu: string,
    pfxBuffer: Buffer,
    pfxSenha:  string,
  ): Promise<ResultadoConsulta> {
    const cUF = '91'; // Ambiente Nacional
    const tpAmb = this.ambiente === 'producao' ? '1' : '2';

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${tpAmb}</tpAmb>
          <cUFAutor>${cUF}</cUFAutor>
          <CNPJ>${cnpj}</CNPJ>
          <distNSU>
            <ultNSU>${ultimoNsu.padStart(15, '0')}</ultNSU>
          </distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;

    const responseXml = await this.postSoap(soapBody, pfxBuffer, pfxSenha);
    return this.parsearResposta(responseXml);
  }

  // ---------------------------------------------------------------------------
  // HTTP POST com mTLS
  // ---------------------------------------------------------------------------

  private postSoap(body: string, pfxBuffer: Buffer, pfxSenha: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url    = new URL(this.url);
      const agent  = new https.Agent({ pfx: pfxBuffer, passphrase: pfxSenha });
      const data   = Buffer.from(body, 'utf8');

      const req = https.request(
        {
          hostname: url.hostname,
          path:     url.pathname,
          method:   'POST',
          agent,
          headers: {
            'Content-Type':   'application/soap+xml; charset=utf-8',
            'Content-Length': data.length,
          },
          timeout: 30_000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data',  (c: Buffer) => chunks.push(c));
          res.on('end',   () => resolve(Buffer.concat(chunks).toString('utf8')));
          res.on('error', reject);
        },
      );

      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout na consulta à SEFAZ.')); });
      req.write(data);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Parse da resposta SOAP
  // ---------------------------------------------------------------------------

  private parsearResposta(responseXml: string): ResultadoConsulta {
    const parser = new XMLParser({
      ignoreAttributes:    false,
      attributeNamePrefix: '@_',
      parseTagValue:       false,
      removeNSPrefix:      true,
      isArray:             (name) => name === 'docZip',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = parser.parse(responseXml);

    // Navega até retDistDFeInt dentro do envelope SOAP
    const retDist =
      obj?.Envelope?.Body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult?.retDistDFeInt
      ?? obj?.Envelope?.Body?.nfeDistDFeInteresseResult?.retDistDFeInt
      ?? null;

    if (!retDist) {
      throw new Error('Resposta da SEFAZ não contém retDistDFeInt.');
    }

    const cStat  = String(retDist.cStat ?? '');
    const xMotivo = String(retDist.xMotivo ?? '');

    // cStat 137 = nenhum documento novo; 138 = documentos retornados
    if (cStat !== '137' && cStat !== '138') {
      throw new Error(`SEFAZ retornou erro ${cStat}: ${xMotivo}`);
    }

    const maxNSU = String(retDist.dhResp ? retDist.maxNSU ?? retDist.ultNSU ?? '000000000000000' : '000000000000000');
    const ultNSU = String(retDist.ultNSU ?? '000000000000000');

    const documentos: DocumentoSefaz[] = [];

    const loteDistDFeInt = retDist.loteDistDFeInt;
    if (!loteDistDFeInt) {
      return { documentos, maxNSU, ultNSU };
    }

    const docZips: any[] = Array.isArray(loteDistDFeInt.docZip)
      ? loteDistDFeInt.docZip
      : (loteDistDFeInt.docZip ? [loteDistDFeInt.docZip] : []);

    for (const docZip of docZips) {
      try {
        const base64 = typeof docZip === 'string' ? docZip : (docZip['#text'] ?? docZip._ ?? '');
        const schema  = String(docZip['@_schema'] ?? '');
        const nsu     = String(docZip['@_NSU'] ?? '');

        // Só processar XMLs completos (procNFe / nfeProc), não resumos (resNFe)
        if (!schema.startsWith('proc')) continue;

        const xmlBuffer = zlib.gunzipSync(Buffer.from(base64, 'base64'));
        const xml       = xmlBuffer.toString('utf8');

        // Extrai chave de acesso do XML
        const chaveMatch = xml.match(/Id="NFe(\d{44})"/);
        const chave      = chaveMatch ? chaveMatch[1] : nsu;

        documentos.push({ xml, chave, nsu, schema });
      } catch {
        // Documento malformado — pula, não trava o lote inteiro
      }
    }

    return { documentos, maxNSU, ultNSU };
  }
}
