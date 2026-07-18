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
  Package,
  RefreshCw,
  Search,
  ChevronRight,
  CreditCard,
  ShieldCheck,
  MapPin,
  QrCode,
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

function formatarBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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

type TabId = 'nfe' | 'emitente' | 'destinatario' | 'produtos' | 'totais' | 'transporte';
const TABS: { id: TabId; label: string }[] = [
  { id: 'nfe',          label: 'NF-e' },
  { id: 'emitente',     label: 'Emitente' },
  { id: 'destinatario', label: 'Destinatário' },
  { id: 'produtos',     label: 'Produtos / Serviços' },
  { id: 'totais',       label: 'Totais' },
  { id: 'transporte',   label: 'Transporte' },
];

function Campo({ label, value, mono, span }: { label: string; value?: string | number | null; mono?: boolean; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2 sm:col-span-3' : ''}>
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm text-gray-800 dark:text-gray-200 ${mono ? 'font-mono break-all' : ''}`}>{value || '—'}</p>
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
              {/* Chave de acesso */}
              {d.chaveAcesso && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Chave de Acesso</p>
                    <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{d.chaveAcesso}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">Versão 4.00</span>
                </div>
              )}

              {/* Dados da NF-e */}
              <Secao titulo="Dados da NF-e">
                <Campo label="Modelo"          value={modeloLabel} />
                <Campo label="Série"           value={d.serie} />
                <Campo label="Número"          value={d.numero} />
                <Campo label="Data de Emissão" value={formatarData(d.dataEmissao)} />
                <Campo label="Tipo da Operação" value={d.tipo === 'saida' ? '1 – Saída' : '0 – Entrada'} />
                <Campo label="Valor Total"      value={brl(d.valorTotal)} />
              </Secao>

              {/* Emitente (resumido) */}
              <Secao titulo="Emitente">
                <Campo label="CNPJ"            value={formatarCNPJ(d.emitente.cnpj)} />
                <Campo label="Nome / Razão Social" value={d.emitente.nome} />
                <Campo label="Inscrição Estadual"  value={d.emitente.ie || '—'} />
                <Campo label="UF"              value={d.emitente.uf} />
                <Campo label="Regime Tributário" value={CRT_LABEL[d.emitente.crt] ?? `CRT ${d.emitente.crt}`} />
              </Secao>

              {/* Destinatário (resumido) */}
              <Secao titulo="Destinatário">
                <Campo label="CNPJ / CPF"      value={d.destinatario.cnpjOuCpf ? formatarCNPJ(d.destinatario.cnpjOuCpf) : '—'} />
                <Campo label="Nome / Razão Social" value={d.destinatario.nome || 'Consumidor Final'} />
                <Campo label="Inscrição Estadual"  value={d.destinatario.ie || '—'} />
                <Campo label="Destino da Operação" value={ID_DEST[d.idDest] ?? `${d.idDest}`} />
                <Campo label="Consumidor Final"    value={d.indFinal === 1 ? 'Sim' : 'Não'} />
                <Campo label="Presença do Comprador" value={IND_PRES[d.indPres] ?? `${d.indPres}`} />
              </Secao>

              {/* Emissão */}
              <Secao titulo="Emissão">
                <Campo label="Processo de Emissão"  value={PROC_EMI[d.procEmi] ?? `${d.procEmi}`} />
                <Campo label="Versão do Processo"   value={d.verProc} />
                <Campo label="Tipo de Emissão"      value={TP_EMIS[d.tpEmis] ?? `${d.tpEmis}`} />
                <Campo label="Finalidade"           value={FIN_NFE[d.finNFe] ?? `${d.finNFe}`} />
                <Campo label="Natureza da Operação" value={d.naturezaOp} />
              </Secao>

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

              {/* QR Code NFC-e */}
              {d.qrCode && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
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
            </>
          )}

          {/* ── ABA: Emitente ── */}
          {tab === 'emitente' && (
            <Secao titulo="Dados do Emitente" cols="grid-cols-1 sm:grid-cols-2">
              <Campo label="CNPJ"              value={formatarCNPJ(d.emitente.cnpj)} />
              <Campo label="Inscrição Estadual" value={d.emitente.ie} />
              <Campo label="Nome / Razão Social" value={d.emitente.nome} />
              <Campo label="Nome Fantasia"      value={d.emitente.nomeFant} />
              <Campo label="Regime Tributário"  value={CRT_LABEL[d.emitente.crt] ?? `CRT ${d.emitente.crt}`} />
              <Campo label="Telefone"           value={d.emitente.telefone} />
              <Campo label="Logradouro"         value={[d.emitente.endereco.logradouro, d.emitente.endereco.numero].filter(Boolean).join(', ')} />
              <Campo label="Bairro"             value={d.emitente.endereco.bairro} />
              <Campo label="Município"          value={d.emitente.municipio} />
              <Campo label="UF"                 value={d.emitente.uf} />
              <Campo label="CEP"                value={d.emitente.endereco.cep} />
            </Secao>
          )}

          {/* ── ABA: Destinatário ── */}
          {tab === 'destinatario' && (
            <Secao titulo="Dados do Destinatário" cols="grid-cols-1 sm:grid-cols-2">
              <Campo label="CNPJ / CPF"          value={d.destinatario.cnpjOuCpf ? formatarCNPJ(d.destinatario.cnpjOuCpf) : '—'} />
              <Campo label="Inscrição Estadual"   value={d.destinatario.ie || '—'} />
              <Campo label="Nome / Razão Social"  value={d.destinatario.nome || 'Consumidor Final'} />
              <Campo label="Destino da Operação"  value={ID_DEST[d.idDest] ?? `${d.idDest}`} />
              <Campo label="Consumidor Final"     value={d.indFinal === 1 ? '1 – Consumidor Final' : '0 – Normal'} />
              <Campo label="Presença do Comprador" value={`${d.indPres} – ${IND_PRES[d.indPres] ?? d.indPres}`} />
            </Secao>
          )}

          {/* ── ABA: Produtos / Serviços ── */}
          {tab === 'produtos' && (
            d.itens.length > 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Produtos / Serviços ({d.itens.length} {d.itens.length === 1 ? 'item' : 'itens'})</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">#</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Descrição</th>
                      <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">CFOP</th>
                      <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">NCM</th>
                      <th className="text-right px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Qtd</th>
                      <th className="text-right px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Vl. Unit</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {d.itens.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <p className="text-gray-800 dark:text-gray-200">{item.descricao || '—'}</p>
                          {item.codigo && <p className="text-[10px] text-gray-400">Cód. {item.codigo}</p>}
                        </td>
                        <td className="px-2 py-2.5 text-center text-xs text-gray-500 dark:text-gray-400">{item.cfop || '—'}</td>
                        <td className="px-2 py-2.5 text-center text-xs font-mono text-gray-500 dark:text-gray-400">{item.ncm || '—'}</td>
                        <td className="px-2 py-2.5 text-right text-gray-600 dark:text-gray-400">{item.quantidade}</td>
                        <td className="px-2 py-2.5 text-right text-xs text-gray-600 dark:text-gray-400">{brl(item.valorUnitario)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {brl(item.valorTotal || item.quantidade * item.valorUnitario)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum produto/serviço encontrado no XML.</p>
            )
          )}

          {/* ── ABA: Totais ── */}
          {tab === 'totais' && (
            <>
              <Secao titulo="Valores da Nota Fiscal" cols="grid-cols-2 sm:grid-cols-3">
                <Campo label="Valor Total"  value={brl(d.valorTotal)} />
                <Campo label="ICMS"         value={brl(d.impostos.icms)} />
                <Campo label="PIS"          value={brl(d.impostos.pis)} />
                <Campo label="COFINS"       value={brl(d.impostos.cofins)} />
                <Campo label="IPI"          value={brl(d.impostos.ipi)} />
                <Campo label="ST"           value={brl(d.impostos.st)} />
                <Campo label="Frete"        value={brl(d.impostos.frete)} />
                <Campo label="Desconto"     value={brl(d.impostos.desconto)} />
              </Secao>

              {d.pagamentos.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                    <CreditCard size={13} className="text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Cobrança / Forma de Pagamento</p>
                  </div>
                  {d.pagamentos.map((pag, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 ${i < d.pagamentos.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{pag.descricao}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{brl(pag.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── ABA: Transporte ── */}
          {tab === 'transporte' && (
            <Secao titulo="Transporte" cols="grid-cols-1 sm:grid-cols-2">
              <Campo label="Modalidade do Frete" value={`${d.transporte.modFrete} – ${MOD_FRETE[d.transporte.modFrete] ?? d.transporte.modFrete}`} />
            </Secao>
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
