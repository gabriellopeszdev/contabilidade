import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseNFe, garantirUrlAbsoluta } from '../../src/utils/nfeParser';

const xml = readFileSync(resolve(process.cwd(), 'nfe-teste.xml'), 'utf8');

describe('parseNFe - campos da consulta SEFAZ-BA', () => {
  it('identifica a NF-e (aba NF-e)', () => {
    const nfe = parseNFe(xml);
    expect(nfe.chaveAcesso).toBe('35260612345678000195550010000001231234567890');
    expect(nfe.versaoXml).toBe('4.00');
    expect(nfe.modelo).toBe(55);
    expect(nfe.serie).toBe('1');
    expect(nfe.numero).toBe('123');
    expect(nfe.tipo).toBe('saida');
    expect(nfe.naturezaOp).toBe('Venda de mercadoria');
    expect(nfe.ambiente).toBe(2);
    expect(nfe.idDest).toBe(1);
    expect(nfe.indFinal).toBe(0);
    expect(nfe.indPres).toBe(1);
    expect(nfe.tpEmis).toBe(1);
    expect(nfe.finNFe).toBe(1);
    expect(nfe.codigoMunicipioFG).toBe('3550308');
    expect(nfe.tipoImpressao).toBe(1);
    expect(nfe.digestValue).toBe('abc123def456==');
  });

  it('extrai emitente completo com endereco', () => {
    const nfe = parseNFe(xml);
    expect(nfe.emitente.cnpj).toBe('12345678000195');
    expect(nfe.emitente.nome).toBe('Escritório Contábil Modelo Ltda');
    expect(nfe.emitente.nomeFant).toBe('Contábil Modelo');
    expect(nfe.emitente.ie).toBe('111111111111');
    expect(nfe.emitente.crt).toBe(3);
    expect(nfe.emitente.endereco.logradouro).toBe('Avenida Paulista');
    expect(nfe.emitente.endereco.numero).toBe('1000');
    expect(nfe.emitente.endereco.bairro).toBe('Bela Vista');
    expect(nfe.emitente.endereco.municipio).toBe('São Paulo');
    expect(nfe.emitente.endereco.uf).toBe('SP');
    expect(nfe.emitente.endereco.cep).toBe('01310100');
    expect(nfe.emitente.endereco.pais).toBe('Brasil');
    expect(nfe.emitente.endereco.telefone).toBe('1133334444');
  });

  it('extrai destinatario com endereco (enderDest)', () => {
    const nfe = parseNFe(xml);
    expect(nfe.destinatario.cnpjOuCpf).toBe('98765432000111');
    expect(nfe.destinatario.nome).toBe('Cliente Empresa ABC S.A.');
    expect(nfe.destinatario.ie).toBe('222222222222');
    expect(nfe.destinatario.indicadorIE).toBe(1);
    expect(nfe.destinatario.endereco.logradouro).toBe('Rua das Flores');
    expect(nfe.destinatario.endereco.numero).toBe('200');
    expect(nfe.destinatario.endereco.bairro).toBe('Centro');
    expect(nfe.destinatario.endereco.municipio).toBe('Rio de Janeiro');
    expect(nfe.destinatario.endereco.uf).toBe('RJ');
    expect(nfe.destinatario.endereco.cep).toBe('20040020');
  });

  it('extrai itens com unidade, EAN e impostos por item', () => {
    const nfe = parseNFe(xml);
    expect(nfe.itens).toHaveLength(3);
    const item = nfe.itens[0];
    expect(item.nItem).toBe(1);
    expect(item.descricao).toContain('Consultoria');
    expect(item.codigo).toBe('001');
    expect(item.ean).toBe('7891234567890');
    expect(item.ncm).toBe('84713012');
    expect(item.cfop).toBe('5933');
    expect(item.unidade).toBe('UN');
    expect(item.quantidade).toBe(3);
    expect(item.valorUnitario).toBe(500);
    expect(item.valorTotal).toBe(1500);
    expect(item.imposto.cst).toBe('00');
    expect(item.imposto.vICMS).toBe(180);
    expect(item.imposto.pICMS).toBe(12);
    expect(item.imposto.vPIS).toBe(9.75);
    expect(nfe.itens[1].valorDesconto).toBe(50);
  });

  it('extrai totais ICMSTot (aba Totais da SEFAZ)', () => {
    const nfe = parseNFe(xml);
    expect(nfe.impostos.baseCalculoIcms).toBe(2200);
    expect(nfe.impostos.icms).toBe(180);
    expect(nfe.impostos.valorProdutos).toBe(3000);
    expect(nfe.impostos.desconto).toBe(50);
    expect(nfe.impostos.pis).toBe(19.18);
    expect(nfe.impostos.cofins).toBe(88.5);
    expect(nfe.valorTotal).toBe(2950);
  });

  it('extrai pagamento, transporte, protocolo e informacoes adicionais', () => {
    const nfe = parseNFe(xml);
    expect(nfe.pagamentos).toHaveLength(1);
    expect(nfe.pagamentos[0].descricao).toBe('Dinheiro');
    expect(nfe.pagamentos[0].valor).toBe(2950);
    expect(nfe.transporte.modFrete).toBe(9);
    expect(nfe.protocolo?.status).toBe(100);
    expect(nfe.protocolo?.numero).toBe('135260000000001');
    expect(nfe.infAdic.infCpl).toContain('homologação');
    expect(nfe.infCompl).toContain('homologação');
  });
});

describe('garantirUrlAbsoluta', () => {
  it('prefixa https quando a SEFAZ omite o esquema', () => {
    expect(garantirUrlAbsoluta('www.sefaz.ba.gov.br/nfce/consulta')).toBe(
      'https://www.sefaz.ba.gov.br/nfce/consulta',
    );
  });

  it('sobe http para https e mantém https', () => {
    expect(garantirUrlAbsoluta('http://www.sefaz.ba.gov.br/nfce/consulta')).toBe(
      'https://www.sefaz.ba.gov.br/nfce/consulta',
    );
    expect(garantirUrlAbsoluta('https://nfe.sefaz.ba.gov.br/x')).toBe(
      'https://nfe.sefaz.ba.gov.br/x',
    );
  });

  it('trata protocolo-relative e vazio', () => {
    expect(garantirUrlAbsoluta('//www.sefaz.ba.gov.br/nfce/consulta')).toBe(
      'https://www.sefaz.ba.gov.br/nfce/consulta',
    );
    expect(garantirUrlAbsoluta('')).toBeNull();
    expect(garantirUrlAbsoluta(null)).toBeNull();
  });
});
