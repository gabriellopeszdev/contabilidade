'use client';

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
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      Saída
    </span>
  );
}

// =============================================================================
// Modal de detalhes da NF-e
// =============================================================================

function ModalDetalheNFe({ resultado, onFechar }: { resultado: ResultadoArquivo; onFechar: () => void }) {
  const d = resultado.dados!;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFechar]);

  const valorTotal = d.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  NF-e {d.numero}{d.serie ? ` / ${d.serie}` : ''}
                </h2>
                <TipoBadge tipo={d.tipo} />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">{resultado.nomeArquivo}</p>
            </div>
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1">

          {/* Chave de acesso + natureza */}
          <div className="space-y-2">
            {d.chaveAcesso && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Chave de Acesso</p>
                <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{d.chaveAcesso}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Data de Emissão</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{formatarData(d.dataEmissao)}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Natureza da Operação</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{d.naturezaOp || '—'}</p>
              </div>
            </div>
          </div>

          {/* Emitente / Destinatário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={14} className="text-blue-500" />
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Emitente</p>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{d.emitente.nome || '—'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{d.emitente.cnpj ? formatarCNPJ(d.emitente.cnpj) : ''}</p>
              {(d.emitente.municipio || d.emitente.uf) && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {[d.emitente.municipio, d.emitente.uf].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={14} className="text-emerald-500" />
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Destinatário</p>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{d.destinatario.nome || '—'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {d.destinatario.cnpjOuCpf ? formatarCNPJ(d.destinatario.cnpjOuCpf) : ''}
              </p>
            </div>
          </div>

          {/* Valores e Impostos */}
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Valores e Impostos</p>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {[
                { label: 'Total NF',  value: d.valorTotal,        highlight: true },
                { label: 'ICMS',      value: d.impostos.icms },
                { label: 'PIS',       value: d.impostos.pis },
                { label: 'COFINS',    value: d.impostos.cofins },
                { label: 'IPI',       value: d.impostos.ipi },
                { label: 'Desconto',  value: d.impostos.desconto, red: true },
              ].map(({ label, value, highlight, red }, i, arr) => (
                <div key={label} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''} ${highlight ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                  <span className={`text-sm font-bold ${
                    highlight ? 'text-blue-700 dark:text-blue-300'
                    : red && value > 0 ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-800 dark:text-gray-200'
                  }`}>
                    {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Itens */}
          {d.itens.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package size={14} className="text-violet-500" />
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Itens ({d.itens.length})
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Descrição</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Qtd</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Vl. Unit.</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {d.itens.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200">{item.descricao || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">{item.quantidade}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">
                          {item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {(item.quantidade * item.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <span className="text-xs text-gray-400">Valor total da nota</span>
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{valorTotal}</span>
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

      const dlRes = await fetch(`/api/v1/documentos/${item.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!dlRes.ok) return;
      const blob = await dlRes.blob();

      const form = new FormData();
      form.append('arquivos', new File([blob], item.fileName, { type: 'application/xml' }));

      const parseRes = await fetch('/api/v1/nfe/importar', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
      if (!parseRes.ok) return;
      const data = await parseRes.json() as { resultados: ResultadoArquivo[] };
      if (data.resultados?.[0]) setNfeSelecionada(data.resultados[0]);
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
      const res = await fetch(`/api/v1/documentos/${item.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = item.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FileCode2 size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">NF-e dos Clientes</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              XMLs enviados pelos seus clientes para importar no DPComp
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
            focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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
          <Loader2 size={28} className="animate-spin text-blue-500" />
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
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
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
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <Building2 size={13} className="text-blue-600 dark:text-blue-400" />
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
                            text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400
                            border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700
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
                            bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors
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
