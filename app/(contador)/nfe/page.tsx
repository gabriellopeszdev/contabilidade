'use client';

import React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  FileCode2,
  FileText,
  AlertTriangle,
  Loader2,
  X,
  Download,
  Building2,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  CreditCard,
  ShieldCheck,
  QrCode,
  Info,
} from 'lucide-react';

import { useAuth }         from '../../../src/presentation/hooks/useAuth';
import type { NFeParseResult } from '../../../src/utils/nfeParser';

// =============================================================================
// Tipos
// =============================================================================

interface ResultadoArquivo {
  nomeArquivo: string;
  ok:          boolean;
  dados?:      NFeParseResult;
  erro?:       string;
}

interface ItemRecebido {
  id:        string;
  fileName:  string;
  createdAt: string;
  cliente: {
    id:   string;
    name: string;
    cnpj: string;
  };
}

// =============================================================================
// Helpers de formatação
// =============================================================================

function formatarCNPJ(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return doc;
}

function formatarData(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatarDataCurta(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso.includes('T') ? iso : `${iso}T12:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function formatarCEP(cep: string): string {
  const d = cep.replace(/\D/g, '');
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return cep || '—';
}

function formatarFone(fone: string): string {
  const d = fone.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return fone || '—';
}

function linhaEndereco(end: {
  logradouro: string; numero: string; complemento: string;
  bairro: string; municipio: string; uf: string;
}): string {
  const rua = [end.logradouro, end.numero, end.complemento].filter(Boolean).join(', ');
  const cidade = [end.bairro, end.municipio, end.uf].filter(Boolean).join(' – ');
  return [rua, cidade].filter(Boolean).join(' · ') || '—';
}

// =============================================================================
// Sub-componente: Badge de tipo de NF-e
// =============================================================================

function TipoBadge({ tipo }: { tipo: 'entrada' | 'saida' }) {
  return tipo === 'entrada' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      Entrada
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary-dark dark:bg-primary/20 dark:text-primary">
      Saída
    </span>
  );
}

// =============================================================================
// Modal de detalhes da NF-e
// =============================================================================

const CRT_LABEL: Record<number, string> = {
  1: 'Simples Nacional', 2: 'Simples Nacional – Excesso', 3: 'Regime Normal', 4: 'MEI',
};
const ID_DEST: Record<number, string> = {
  1: 'Operação interna', 2: 'Operação interestadual', 3: 'Com exterior',
};
const IND_PRES: Record<number, string> = {
  0: 'Não se aplica', 1: 'Presencial', 2: 'Internet', 3: 'Teleatendimento',
  4: 'Entrega a domicílio', 5: 'Fora do estabelecimento', 9: 'Outros',
};
const TP_EMIS: Record<number, string> = {
  1: 'Normal', 2: 'Contingência FS-IA', 3: 'Contingência SCAN',
  4: 'Contingência DPEC', 5: 'Contingência FS-DA', 6: 'Contingência SVC-AN',
  7: 'Contingência SVC-RS', 9: 'Off-line NFC-e',
};
const FIN_NFE: Record<number, string> = {
  1: 'NF-e normal', 2: 'NF-e complementar', 3: 'NF-e de ajuste', 4: 'Devolução',
};
const PROC_EMI: Record<number, string> = {
  0: 'Aplicativo do contribuinte', 1: 'Avulsa pelo Fisco',
  2: 'Avulsa pelo IBPT', 3: 'Aplicativo do Fisco',
};
const MOD_FRETE: Record<number, string> = {
  0: 'Por conta do emitente (CIF)', 1: 'Por conta do destinatário (FOB)',
  2: 'Por conta de terceiros', 3: 'Próprio – remetente',
  4: 'Próprio – destinatário', 9: 'Sem frete',
};
const TP_IMP: Record<number, string> = {
  0: 'Sem DANFE', 1: 'DANFE Retrato', 2: 'DANFE Paisagem',
  3: 'DANFE Simplificado', 4: 'DANFE NFC-e', 5: 'DANFE NFC-e mensagem eletrônica',
};
const IND_IE: Record<number, string> = {
  1: 'Contribuinte ICMS', 2: 'Contribuinte isento', 9: 'Não contribuinte',
};
const IND_PAG: Record<number, string> = {
  0: 'À vista', 1: 'A prazo',
};
const ORIGEM_MERC: Record<string, string> = {
  '0': 'Nacional',
  '1': 'Estrangeira – importação direta',
  '2': 'Estrangeira – adquirida no mercado interno',
  '3': 'Nacional – conteúdo de importação > 40%',
  '4': 'Nacional – produção conforme PPB',
  '5': 'Nacional – conteúdo de importação ≤ 40%',
  '6': 'Estrangeira – importação direta sem similar',
  '7': 'Estrangeira – mercado interno sem similar',
  '8': 'Nacional – conteúdo de importação > 70%',
};

type TabId = 'nfe' | 'emitente' | 'destinatario' | 'produtos' | 'totais' | 'cobranca' | 'transporte' | 'info';
const TABS: { id: TabId; label: string }[] = [
  { id: 'nfe',          label: 'NF-e' },
  { id: 'emitente',     label: 'Emitente' },
  { id: 'destinatario', label: 'Destinatário' },
  { id: 'produtos',     label: 'Produtos / Serviços' },
  { id: 'totais',       label: 'Totais' },
  { id: 'cobranca',     label: 'Cobrança' },
  { id: 'transporte',   label: 'Transporte' },
  { id: 'info',         label: 'Informações Adicionais' },
];

function Campo({ label, value, mono, span }: { label: string; value?: string | number | null; mono?: boolean; span?: boolean }) {
  const vazio = value === undefined || value === null || value === '';
  return (
    <div className={span ? 'col-span-2 sm:col-span-3' : ''}>
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 dark:text-gray-200 ${mono ? 'font-mono break-all' : ''}`}>{vazio ? '—' : value}</p>
    </div>
  );
}

function Secao({ titulo, children, cols }: { titulo: string; children: React.ReactNode; cols?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-bold text-blue-700 dark:text-blue-400">{titulo}</p>
      </div>
      <div className={`p-4 grid gap-4 ${cols ?? 'grid-cols-2 sm:grid-cols-3'}`}>
        {children}
      </div>
    </div>
  );
}

function ModalDetalheNFe({ resultado, onFechar }: { resultado: ResultadoArquivo; onFechar: () => void }) {
  const d = resultado.dados!;
  const [tab, setTab] = useState<TabId>('nfe');
  const [itemAberto, setItemAberto] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFechar]);

  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const modeloLabel = d.modelo === 65 ? 'NFC-e' : d.modelo === 55 ? 'NF-e' : `Mod. ${d.modelo}`;
  const ambienteLabel = d.ambiente === 2 ? 'Homologação' : 'Produção';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <FileText size={18} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {modeloLabel} {d.numero}{d.serie ? ` / Série ${d.serie}` : ''}
                </h2>
                <TipoBadge tipo={d.tipo} />
                {d.ambiente === 2 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {ambienteLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">{resultado.nomeArquivo}</p>
            </div>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs nav */}
        <div className="flex items-center gap-0.5 px-4 border-b border-gray-100 dark:border-gray-800 overflow-x-auto shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary dark:text-primary'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── ABA: NF-e ── */}
          {tab === 'nfe' && (
            <>
              {d.chaveAcesso && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Chave de Acesso</p>
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{d.chaveAcesso}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">Versão {d.versaoXml || '4.00'}</span>
                </div>
              )}

              <Secao titulo="Dados da NF-e">
                <Campo label="Modelo"              value={modeloLabel} />
                <Campo label="Série"               value={d.serie} />
                <Campo label="Número"              value={d.numero} />
                <Campo label="Data de Emissão"     value={formatarData(d.dataEmissao)} />
                <Campo label="Data Saída/Entrada"  value={d.dataSaidaEntrada ? formatarData(d.dataSaidaEntrada) : '—'} />
                <Campo label="Tipo da Operação"    value={d.tipo === 'saida' ? '1 – Saída' : '0 – Entrada'} />
                <Campo label="Destino da Operação" value={ID_DEST[d.idDest] ?? String(d.idDest)} />
                <Campo label="Formato DANFE"       value={TP_IMP[d.tipoImpressao] ?? String(d.tipoImpressao)} />
                <Campo label="Município FG (IBGE)" value={d.codigoMunicipioFG} />
                <Campo label="Código numérico"     value={d.codigoNF} />
                <Campo label="DV"                  value={d.codigoDV} />
                <Campo label="Valor Total"         value={brl(d.valorTotal)} />
              </Secao>

              <Secao titulo="Emitente">
                <Campo label="CNPJ / CPF"          value={formatarCNPJ(d.emitente.cnpj || d.emitente.cpf)} />
                <Campo label="Nome / Razão Social" value={d.emitente.nome} />
                <Campo label="Nome Fantasia"       value={d.emitente.nomeFant} />
                <Campo label="Inscrição Estadual"  value={d.emitente.ie} />
                <Campo label="UF"                  value={d.emitente.uf} />
                <Campo label="Regime Tributário"   value={CRT_LABEL[d.emitente.crt] ?? `CRT ${d.emitente.crt}`} />
              </Secao>

              <Secao titulo="Destinatário">
                <Campo label="CNPJ / CPF"            value={d.destinatario.cnpjOuCpf ? formatarCNPJ(d.destinatario.cnpjOuCpf) : '—'} />
                <Campo label="Nome / Razão Social"   value={d.destinatario.nome || 'Consumidor Final'} />
                <Campo label="Inscrição Estadual"    value={d.destinatario.ie} />
                <Campo label="Indicador IE"          value={IND_IE[d.destinatario.indicadorIE] ?? (d.destinatario.indicadorIE ? String(d.destinatario.indicadorIE) : '—')} />
                <Campo label="Consumidor Final"      value={d.indFinal === 1 ? '1 – Sim' : '0 – Não'} />
                <Campo label="Presença do Comprador" value={IND_PRES[d.indPres] ?? String(d.indPres)} />
              </Secao>

              <Secao titulo="Emissão">
                <Campo label="Processo de Emissão"  value={PROC_EMI[d.procEmi] ?? String(d.procEmi)} />
                <Campo label="Versão do Processo"   value={d.verProc} />
                <Campo label="Tipo de Emissão"      value={TP_EMIS[d.tpEmis] ?? String(d.tpEmis)} />
                <Campo label="Finalidade"           value={FIN_NFE[d.finNFe] ?? String(d.finNFe)} />
                <Campo label="Natureza da Operação" value={d.naturezaOp} span />
              </Secao>

              {d.digestValue && (
                <Secao titulo="Digest Value" cols="grid-cols-1">
                  <Campo label="Digest Value" value={d.digestValue} mono />
                </Secao>
              )}

              {/* Situação atual + Protocolo */}
              {d.protocolo && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Situação Atual: {d.protocolo.status === 100 ? 'AUTORIZADA' : `Cód. ${d.protocolo.status}`}
                      {d.ambiente === 1 ? ' (Produção)' : ' (Homologação)'}
                    </p>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Evento</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{d.protocolo.motivo}</p>
                    </div>
                    <Campo label="Protocolo"    value={d.protocolo.numero} mono />
                    <Campo label="Data / Hora"  value={formatarData(d.protocolo.dataHora)} />
                  </div>
                </div>
              )}

              {(d.qrCode || d.urlChave) && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2">
                  {d.qrCode && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <QrCode size={13} className="text-gray-400" />
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">QR Code NFC-e</p>
                      </div>
                      <a href={d.qrCode} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] font-mono text-primary break-all hover:underline">
                        {d.qrCode}
                      </a>
                    </div>
                  )}
                  {d.urlChave && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">URL da consulta</p>
                      <a href={d.urlChave} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] font-mono text-primary break-all hover:underline">
                        {d.urlChave}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── ABA: Emitente ── */}
          {tab === 'emitente' && (
            <>
              <Secao titulo="Dados do Emitente" cols="grid-cols-1 sm:grid-cols-2">
                <Campo label="CNPJ"                 value={d.emitente.cnpj ? formatarCNPJ(d.emitente.cnpj) : '—'} />
                <Campo label="CPF"                  value={d.emitente.cpf ? formatarCNPJ(d.emitente.cpf) : '—'} />
                <Campo label="Nome / Razão Social"  value={d.emitente.nome} />
                <Campo label="Nome Fantasia"        value={d.emitente.nomeFant} />
                <Campo label="Inscrição Estadual"   value={d.emitente.ie} />
                <Campo label="IE do Substituto"     value={d.emitente.ieSt} />
                <Campo label="Inscrição Municipal"  value={d.emitente.im} />
                <Campo label="CNAE"                 value={d.emitente.cnae} />
                <Campo label="Regime Tributário"    value={CRT_LABEL[d.emitente.crt] ?? `CRT ${d.emitente.crt}`} />
                <Campo label="Telefone"             value={d.emitente.telefone ? formatarFone(d.emitente.telefone) : '—'} />
              </Secao>
              <Secao titulo="Endereço" cols="grid-cols-1 sm:grid-cols-2">
                <Campo label="Logradouro"           value={d.emitente.endereco.logradouro} />
                <Campo label="Número"               value={d.emitente.endereco.numero} />
                <Campo label="Complemento"          value={d.emitente.endereco.complemento} />
                <Campo label="Bairro"               value={d.emitente.endereco.bairro} />
                <Campo label="Município"            value={d.emitente.endereco.municipio} />
                <Campo label="Código Município"     value={d.emitente.endereco.codigoMunicipio} />
                <Campo label="UF"                   value={d.emitente.endereco.uf} />
                <Campo label="CEP"                  value={d.emitente.endereco.cep ? formatarCEP(d.emitente.endereco.cep) : '—'} />
                <Campo label="País"                 value={d.emitente.endereco.pais} />
                <Campo label="Município FG (IBGE)"  value={d.codigoMunicipioFG} />
              </Secao>
            </>
          )}

          {/* ── ABA: Destinatário ── */}
          {tab === 'destinatario' && (
            <>
              <Secao titulo="Dados do Destinatário" cols="grid-cols-1 sm:grid-cols-2">
                <Campo label="CNPJ / CPF"            value={d.destinatario.cnpjOuCpf ? formatarCNPJ(d.destinatario.cnpjOuCpf) : '—'} />
                <Campo label="Nome / Razão Social"   value={d.destinatario.nome || 'Consumidor Final'} />
                <Campo label="Inscrição Estadual"    value={d.destinatario.ie} />
                <Campo label="Indicador IE"          value={IND_IE[d.destinatario.indicadorIE] ?? (d.destinatario.indicadorIE ? String(d.destinatario.indicadorIE) : '—')} />
                <Campo label="Inscrição Municipal"   value={d.destinatario.im} />
                <Campo label="Inscrição SUFRAMA"     value={d.destinatario.suframa} />
                <Campo label="E-mail"                value={d.destinatario.email} />
                <Campo label="Telefone"              value={d.destinatario.endereco.telefone ? formatarFone(d.destinatario.endereco.telefone) : '—'} />
                <Campo label="Destino da Operação"   value={ID_DEST[d.idDest] ?? String(d.idDest)} />
                <Campo label="Consumidor Final"      value={d.indFinal === 1 ? '1 – Consumidor Final' : '0 – Normal'} />
                <Campo label="Presença do Comprador" value={`${d.indPres} – ${IND_PRES[d.indPres] ?? d.indPres}`} />
              </Secao>
              <Secao titulo="Endereço" cols="grid-cols-1 sm:grid-cols-2">
                <Campo label="Logradouro"       value={d.destinatario.endereco.logradouro} />
                <Campo label="Número"           value={d.destinatario.endereco.numero} />
                <Campo label="Complemento"      value={d.destinatario.endereco.complemento} />
                <Campo label="Bairro"           value={d.destinatario.endereco.bairro} />
                <Campo label="Município"        value={d.destinatario.endereco.municipio} />
                <Campo label="Código Município" value={d.destinatario.endereco.codigoMunicipio} />
                <Campo label="UF"               value={d.destinatario.endereco.uf} />
                <Campo label="CEP"              value={d.destinatario.endereco.cep ? formatarCEP(d.destinatario.endereco.cep) : '—'} />
                <Campo label="País"             value={d.destinatario.endereco.pais} />
              </Secao>
              {d.localEntrega && (
                <Secao titulo="Local de Entrega" cols="grid-cols-1 sm:grid-cols-2">
                  <Campo label="Endereço" value={linhaEndereco(d.localEntrega)} span />
                  <Campo label="CEP"      value={d.localEntrega.cep ? formatarCEP(d.localEntrega.cep) : '—'} />
                  <Campo label="País"     value={d.localEntrega.pais} />
                </Secao>
              )}
              {d.localRetirada && (
                <Secao titulo="Local de Retirada" cols="grid-cols-1 sm:grid-cols-2">
                  <Campo label="Endereço" value={linhaEndereco(d.localRetirada)} span />
                  <Campo label="CEP"      value={d.localRetirada.cep ? formatarCEP(d.localRetirada.cep) : '—'} />
                  <Campo label="País"     value={d.localRetirada.pais} />
                </Secao>
              )}
            </>
          )}

          {/* ── ABA: Produtos / Serviços ── */}
          {tab === 'produtos' && (
            d.itens.length > 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Produtos / Serviços ({d.itens.length} {d.itens.length === 1 ? 'item' : 'itens'})</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-8" />
                        <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">#</th>
                        <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Descrição</th>
                        <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">CFOP</th>
                        <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">NCM</th>
                        <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Un</th>
                        <th className="text-right px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Qtd</th>
                        <th className="text-right px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Vl. Unit</th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {d.itens.map((item, i) => {
                        const aberto = itemAberto === i;
                        return (
                          <React.Fragment key={i}>
                            <tr
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                              onClick={() => setItemAberto(aberto ? null : i)}
                            >
                              <td className="px-3 py-2.5 text-gray-400">
                                {aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              </td>
                              <td className="px-2 py-2.5 text-xs text-gray-400">{item.nItem || i + 1}</td>
                              <td className="px-2 py-2.5">
                                <p className="text-gray-800 dark:text-gray-200">{item.descricao || '—'}</p>
                                {item.codigo && <p className="text-[10px] text-gray-400">Cód. {item.codigo}</p>}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400">{item.cfop || '—'}</td>
                              <td className="px-2 py-2.5 text-center text-xs font-mono text-gray-500 dark:text-gray-400">{item.ncm || '—'}</td>
                              <td className="px-2 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400">{item.unidade || '—'}</td>
                              <td className="px-2 py-2.5 text-right text-gray-600 dark:text-gray-400">{item.quantidade}</td>
                              <td className="px-2 py-2.5 text-right text-xs text-gray-600 dark:text-gray-400">{brl(item.valorUnitario)}</td>
                              <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                                {brl(item.valorTotal || item.quantidade * item.valorUnitario)}
                              </td>
                            </tr>
                            {aberto && (
                              <tr className="bg-gray-50/80 dark:bg-gray-800/40">
                                <td colSpan={9} className="px-4 py-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <Campo label="EAN comercial"        value={item.ean} />
                                    <Campo label="EAN tributável"       value={item.eanTrib} />
                                    <Campo label="CEST"                 value={item.cest} />
                                    <Campo label="Unidade tributável"   value={item.unidadeTrib} />
                                    <Campo label="Qtd. tributável"      value={item.quantidadeTrib || undefined} />
                                    <Campo label="Vl. unit. tributável" value={item.valorUnitarioTrib ? brl(item.valorUnitarioTrib) : undefined} />
                                    <Campo label="Frete"                value={brl(item.valorFrete)} />
                                    <Campo label="Seguro"               value={brl(item.valorSeguro)} />
                                    <Campo label="Desconto"             value={brl(item.valorDesconto)} />
                                    <Campo label="Outras despesas"      value={brl(item.outrasDespesas)} />
                                    <Campo label="Pedido"               value={item.pedido} />
                                    <Campo label="Item do pedido"       value={item.itemPedido} />
                                    <Campo label="Origem"               value={item.imposto.origem ? `${item.imposto.origem} – ${ORIGEM_MERC[item.imposto.origem] ?? item.imposto.origem}` : undefined} />
                                    <Campo label="CST / CSOSN"          value={item.imposto.cst || item.imposto.csosn} />
                                    <Campo label="BC ICMS"              value={brl(item.imposto.vBC)} />
                                    <Campo label="Alíq. ICMS"           value={item.imposto.pICMS ? `${item.imposto.pICMS}%` : undefined} />
                                    <Campo label="ICMS"                 value={brl(item.imposto.vICMS)} />
                                    <Campo label="PIS"                  value={brl(item.imposto.vPIS)} />
                                    <Campo label="COFINS"               value={brl(item.imposto.vCOFINS)} />
                                    <Campo label="IPI"                  value={brl(item.imposto.vIPI)} />
                                    <Campo label="Tributos aproximados" value={brl(item.imposto.vTotTrib)} />
                                    {item.infAdProd && <Campo label="Info. adicional" value={item.infAdProd} span />}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum produto/serviço encontrado no XML.</p>
            )
          )}

          {/* ── ABA: Totais ── */}
          {tab === 'totais' && (
            <>
              <Secao titulo="ICMS" cols="grid-cols-2 sm:grid-cols-3">
                <Campo label="Base de Cálculo ICMS"     value={brl(d.impostos.baseCalculoIcms)} />
                <Campo label="Valor do ICMS"            value={brl(d.impostos.icms)} />
                <Campo label="ICMS Desonerado"          value={brl(d.impostos.icmsDesonerado)} />
                <Campo label="Base de Cálculo ICMS ST"  value={brl(d.impostos.baseCalculoSt)} />
                <Campo label="ICMS Substituição (ST)"   value={brl(d.impostos.st)} />
                <Campo label="FCP"                      value={brl(d.impostos.fcp)} />
                <Campo label="FCP ST"                   value={brl(d.impostos.fcpSt)} />
                <Campo label="FCP ST Retido"            value={brl(d.impostos.fcpStRet)} />
                <Campo label="ICMS UF Destino"          value={brl(d.impostos.icmsUfDest)} />
                <Campo label="ICMS UF Remetente"        value={brl(d.impostos.icmsUfRemet)} />
                <Campo label="FCP UF Destino"           value={brl(d.impostos.fcpUfDest)} />
              </Secao>
              <Secao titulo="Valores da Nota" cols="grid-cols-2 sm:grid-cols-3">
                <Campo label="Valor dos Produtos"       value={brl(d.impostos.valorProdutos)} />
                <Campo label="Frete"                    value={brl(d.impostos.frete)} />
                <Campo label="Seguro"                   value={brl(d.impostos.seguro)} />
                <Campo label="Desconto"                 value={brl(d.impostos.desconto)} />
                <Campo label="Outras Despesas"          value={brl(d.impostos.outrasDespesas)} />
                <Campo label="II (Imposto de Importação)" value={brl(d.impostos.ii)} />
                <Campo label="IPI"                      value={brl(d.impostos.ipi)} />
                <Campo label="IPI Devolvido"            value={brl(d.impostos.ipiDevolvido)} />
                <Campo label="PIS"                      value={brl(d.impostos.pis)} />
                <Campo label="COFINS"                   value={brl(d.impostos.cofins)} />
                <Campo label="Tributos Aproximados"     value={brl(d.impostos.tributosAproximados)} />
                <Campo label="Valor Total da NF-e"      value={brl(d.valorTotal)} />
              </Secao>
              {(d.impostos.ibs > 0 || d.impostos.cbs > 0 || d.impostos.is > 0 || d.impostos.baseCalculoIbsCbs > 0) && (
                <Secao titulo="Reforma Tributária (IBS / CBS / IS)" cols="grid-cols-2 sm:grid-cols-3">
                  <Campo label="Base de Cálculo IBS/CBS" value={brl(d.impostos.baseCalculoIbsCbs)} />
                  <Campo label="IBS"                     value={brl(d.impostos.ibs)} />
                  <Campo label="CBS"                     value={brl(d.impostos.cbs)} />
                  <Campo label="IS (Imposto Seletivo)"   value={brl(d.impostos.is)} />
                </Secao>
              )}
            </>
          )}

          {/* ── ABA: Cobrança ── */}
          {tab === 'cobranca' && (
            <>
              {d.cobranca.fatura && (
                <Secao titulo="Fatura" cols="grid-cols-2 sm:grid-cols-4">
                  <Campo label="Número"          value={d.cobranca.fatura.numero} />
                  <Campo label="Valor Original"  value={brl(d.cobranca.fatura.valorOriginal)} />
                  <Campo label="Desconto"        value={brl(d.cobranca.fatura.valorDesconto)} />
                  <Campo label="Valor Líquido"   value={brl(d.cobranca.fatura.valorLiquido)} />
                </Secao>
              )}

              {d.cobranca.duplicatas.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Duplicatas</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Número</th>
                        <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Vencimento</th>
                        <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {d.cobranca.duplicatas.map((dup, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{dup.numero || '—'}</td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatarDataCurta(dup.vencimento)}</td>
                          <td className="px-4 py-2 text-right font-semibold">{brl(dup.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {d.pagamentos.length > 0 ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                    <CreditCard size={13} className="text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Formas de Pagamento</p>
                  </div>
                  {d.pagamentos.map((pag, i) => (
                    <div key={i} className={`px-4 py-3 ${i < d.pagamentos.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {pag.tipo} – {pag.descricao}
                          {pag.bandeira ? ` · ${pag.bandeira}` : ''}
                        </span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{brl(pag.valor)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-gray-400">
                        {pag.indPag !== undefined && IND_PAG[pag.indPag] && <span>{IND_PAG[pag.indPag]}</span>}
                        {pag.cnpjCredenciadora && <span>Credenciadora {formatarCNPJ(pag.cnpjCredenciadora)}</span>}
                        {pag.autorizacao && <span>Aut. {pag.autorizacao}</span>}
                      </div>
                    </div>
                  ))}
                  {d.troco > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Troco</span>
                      <span className="text-sm font-bold">{brl(d.troco)}</span>
                    </div>
                  )}
                </div>
              ) : (
                !d.cobranca.fatura && d.cobranca.duplicatas.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhuma informação de cobrança no XML.</p>
                )
              )}
            </>
          )}

          {/* ── ABA: Transporte ── */}
          {tab === 'transporte' && (
            <>
              <Secao titulo="Modalidade" cols="grid-cols-1 sm:grid-cols-2">
                <Campo label="Modalidade do Frete" value={`${d.transporte.modFrete} – ${MOD_FRETE[d.transporte.modFrete] ?? d.transporte.modFrete}`} span />
              </Secao>
              {d.transporte.transportador && (
                <Secao titulo="Transportador" cols="grid-cols-1 sm:grid-cols-2">
                  <Campo label="CNPJ / CPF"          value={d.transporte.transportador.cnpjOuCpf ? formatarCNPJ(d.transporte.transportador.cnpjOuCpf) : '—'} />
                  <Campo label="Nome / Razão Social" value={d.transporte.transportador.nome} />
                  <Campo label="Inscrição Estadual"  value={d.transporte.transportador.ie} />
                  <Campo label="Endereço"            value={d.transporte.transportador.endereco} />
                  <Campo label="Município"           value={d.transporte.transportador.municipio} />
                  <Campo label="UF"                  value={d.transporte.transportador.uf} />
                </Secao>
              )}
              {d.transporte.veiculo && (
                <Secao titulo="Veículo" cols="grid-cols-1 sm:grid-cols-3">
                  <Campo label="Placa" value={d.transporte.veiculo.placa} />
                  <Campo label="UF"    value={d.transporte.veiculo.uf} />
                  <Campo label="RNTC"  value={d.transporte.veiculo.rntc} />
                </Secao>
              )}
              {d.transporte.volumes.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Volumes</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Qtd</th>
                        <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Espécie</th>
                        <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Marca</th>
                        <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Numeração</th>
                        <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Peso Líq.</th>
                        <th className="text-right px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase">Peso Bruto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {d.transporte.volumes.map((vol, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-right">{vol.quantidade || '—'}</td>
                          <td className="px-4 py-2">{vol.especie || '—'}</td>
                          <td className="px-4 py-2">{vol.marca || '—'}</td>
                          <td className="px-4 py-2">{vol.numeracao || '—'}</td>
                          <td className="px-4 py-2 text-right">{vol.pesoLiquido || '—'}</td>
                          <td className="px-4 py-2 text-right">{vol.pesoBruto || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── ABA: Informações Adicionais ── */}
          {tab === 'info' && (
            <>
              <Secao titulo="Formato de Impressão" cols="grid-cols-1 sm:grid-cols-2">
                <Campo label="Tipo de Impressão DANFE" value={TP_IMP[d.tipoImpressao] ?? String(d.tipoImpressao)} />
              </Secao>
              {(d.infAdic.infCpl || d.infCompl) && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                    <Info size={13} className="text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Informações Complementares</p>
                  </div>
                  <p className="p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{d.infAdic.infCpl || d.infCompl}</p>
                </div>
              )}
              {d.infAdic.infAdFisco && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Informações de Interesse do Fisco</p>
                  </div>
                  <p className="p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{d.infAdic.infAdFisco}</p>
                </div>
              )}
              {d.infAdic.observacoes.length > 0 && (
                <Secao titulo="Observações do Contribuinte" cols="grid-cols-1">
                  {d.infAdic.observacoes.map((obs, i) => (
                    <Campo key={i} label={obs.campo || `Observação ${i + 1}`} value={obs.texto} />
                  ))}
                </Secao>
              )}
              {!d.infAdic.infCpl && !d.infCompl && !d.infAdic.infAdFisco && d.infAdic.observacoes.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma informação adicional no XML.</p>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <span className="text-xs text-gray-400">Valor total da nota</span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{brl(d.valorTotal)}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Página principal: /nfe — NF-e dos Clientes
// =============================================================================

export default function NfePage() {
  const { getToken } = useAuth();

  const [xmls,          setXmls]          = useState<ItemRecebido[]>([]);
  const [carregando,    setCarregando]    = useState(true);
  const [erro,          setErro]          = useState<string | null>(null);
  const [nfeSelecionada, setNfeSelecionada] = useState<ResultadoArquivo | null>(null);
  const [visualizandoId, setVisualizandoId] = useState<string | null>(null);
  const [baixandoId,    setBaixandoId]    = useState<string | null>(null);
  const [busca,         setBusca]         = useState('');

  // ---------------------------------------------------------------------------
  // Carregar lista de XMLs recebidos
  // ---------------------------------------------------------------------------

  const carregarLista = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/v1/nfe/recebidas', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json() as { items: ItemRecebido[] };
      setXmls(data.items);
    } catch {
      setErro('Não foi possível carregar as NF-es dos clientes. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [getToken]);

  useEffect(() => { void carregarLista(); }, [carregarLista]);

  // ---------------------------------------------------------------------------
  // Visualizar: baixa o XML e abre o modal com os dados parseados
  // ---------------------------------------------------------------------------

  const handleVisualizar = useCallback(async (item: ItemRecebido) => {
    setVisualizandoId(item.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/v1/nfe/recebidas/${item.id}/visualizar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as ResultadoArquivo;
      if (data.ok && data.dados) setNfeSelecionada(data);
    } finally {
      setVisualizandoId(null);
    }
  }, [getToken]);

  // ---------------------------------------------------------------------------
  // Baixar: salva o XML no disco
  // ---------------------------------------------------------------------------

  const handleBaixar = useCallback(async (item: ItemRecebido) => {
    setBaixandoId(item.id);
    try {
      const token = await getToken();

      // 1. Obtém a pre-signed URL do MinIO
      const dlRes = await fetch(`/api/v1/documentos/${item.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!dlRes.ok) return;
      const { url: presignedUrl, nomeArquivo } = await dlRes.json() as { url: string; nomeArquivo?: string };

      // 2. Baixa o arquivo real a partir da URL pré-assinada
      const fileRes = await fetch(presignedUrl);
      if (!fileRes.ok) return;
      const blob   = await fileRes.blob();
      const objUrl = URL.createObjectURL(blob);
      const a      = document.createElement('a');
      a.href       = objUrl;
      a.download   = nomeArquivo ?? item.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    } finally {
      setBaixandoId(null);
    }
  }, [getToken]);

  // ---------------------------------------------------------------------------
  // Filtro por busca
  // ---------------------------------------------------------------------------

  const xmlsFiltrados = busca.trim()
    ? xmls.filter((x) =>
        x.cliente.name.toLowerCase().includes(busca.toLowerCase()) ||
        x.fileName.toLowerCase().includes(busca.toLowerCase())
      )
    : xmls;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <FileCode2 size={18} className="text-primary dark:text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">NF-e dos Clientes</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              XMLs de NF-e enviados pelos seus clientes
            </p>
          </div>
        </div>
        <button
          onClick={() => void carregarLista()}
          disabled={carregando}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400
            hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700
            hover:border-gray-300 dark:hover:border-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Busca                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente ou arquivo…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Erro                                                                 */}
      {/* ------------------------------------------------------------------ */}
      {erro && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{erro}</p>
          <button onClick={() => setErro(null)} className="text-red-400 hover:text-red-600">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Conteúdo principal                                                   */}
      {/* ------------------------------------------------------------------ */}
      {carregando ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-16 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Carregando NF-es…</p>
        </div>
      ) : xmlsFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-16 flex flex-col items-center gap-3 text-center">
          <FileCode2 size={36} className="text-gray-300 dark:text-gray-700" />
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {busca ? 'Nenhum resultado para a busca' : 'Nenhum XML recebido ainda'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {busca
                ? 'Tente buscar por outro nome de cliente ou arquivo.'
                : 'Quando um cliente enviar um arquivo XML, ele aparecerá aqui.'}
            </p>
          </div>
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="text-xs font-medium text-primary dark:text-primary hover:underline"
            >
              Limpar busca
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {xmlsFiltrados.length} arquivo(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Arquivo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Recebido em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {xmlsFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    {/* Cliente */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                          <Building2 size={13} className="text-primary dark:text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.cliente.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{formatarCNPJ(item.cliente.cnpj)}</p>
                        </div>
                      </div>
                    </td>

                    {/* Arquivo */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileCode2 size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[240px] truncate" title={item.fileName}>
                          {item.fileName}
                        </span>
                      </div>
                    </td>

                    {/* Data */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatarData(item.createdAt)}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {/* Ver detalhes */}
                        <button
                          type="button"
                          onClick={() => void handleVisualizar(item)}
                          disabled={visualizandoId === item.id || baixandoId === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                            text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary
                            border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary
                            rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {visualizandoId === item.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <ChevronRight size={12} />
                          }
                          Ver detalhes
                        </button>

                        {/* Baixar */}
                        <button
                          type="button"
                          onClick={() => void handleBaixar(item)}
                          disabled={baixandoId === item.id || visualizandoId === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white
                            bg-primary hover:bg-primary-dark rounded-lg transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {baixandoId === item.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Download size={12} />
                          }
                          Baixar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de detalhes */}
      {nfeSelecionada?.dados && (
        <ModalDetalheNFe
          resultado={nfeSelecionada}
          onFechar={() => setNfeSelecionada(null)}
        />
      )}
    </div>
  );
}
