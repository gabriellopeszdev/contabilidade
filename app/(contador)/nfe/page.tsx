'use client';

import { useState, useCallback, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, X, Sparkles, Lock, Trash2, ChevronRight, Building2, Package } from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
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
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

// =============================================================================
// Sub-componente: Dropzone
// =============================================================================

interface DropzoneProps {
  onArquivos: (files: File[]) => void;
  carregando: boolean;
}

function Dropzone({ onArquivos, carregando }: DropzoneProps) {
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processarArquivos = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const xmls = Array.from(files).filter((f) =>
      f.name.toLowerCase().endsWith('.xml') ||
      f.type === 'application/xml' ||
      f.type === 'text/xml'
    );
    if (xmls.length > 0) onArquivos(xmls);
  }, [onArquivos]);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    processarArquivos(e.dataTransfer.files);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    processarArquivos(e.target.files);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Selecionar arquivos XML de NF-e"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !carregando && inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      className={`
        flex flex-col items-center justify-center gap-3 p-10 rounded-xl
        border-2 border-dashed transition-colors cursor-pointer select-none
        ${arrastando
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
        }
        ${carregando ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
      `}
    >
      {carregando ? (
        <Loader2 size={36} className="text-blue-500 animate-spin" />
      ) : (
        <Upload size={36} className={arrastando ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'} />
      )}

      <div className="text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {carregando ? 'Processando arquivos…' : 'Arraste XMLs de NF-e aqui ou clique para selecionar'}
        </p>
        {!carregando && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Aceita arquivos .xml — máx. 20 arquivos, 2 MB cada
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        multiple
        className="sr-only"
        onChange={onChange}
        disabled={carregando}
      />
    </div>
  );
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

  // Fecha com Escape
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
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: 'Total NF',  value: d.valorTotal,         highlight: true },
                { label: 'ICMS',      value: d.impostos.icms },
                { label: 'PIS',       value: d.impostos.pis },
                { label: 'COFINS',    value: d.impostos.cofins },
                { label: 'IPI',       value: d.impostos.ipi },
                { label: 'Desconto',  value: d.impostos.desconto,  red: true },
              ].map(({ label, value, highlight, red }) => (
                <div key={label} className={`p-3 rounded-lg border text-center ${
                  highlight
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className={`text-xs font-bold mt-0.5 ${
                    highlight ? 'text-blue-700 dark:text-blue-300'
                    : red && value > 0 ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-800 dark:text-gray-200'
                  }`}>
                    {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
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
// Página principal: /nfe — Importar NF-e
// =============================================================================

export default function NfePage() {
  const { getToken } = useAuth();

  const [carregando,     setCarregando]     = useState(false);
  const [resultados,     setResultados]     = useState<ResultadoArquivo[]>([]);
  const [erroGlobal,     setErroGlobal]     = useState<string | null>(null);
  const [nfeSelecionada, setNfeSelecionada] = useState<ResultadoArquivo | null>(null);

  const [analiseIa, setAnaliseIa]             = useState<{
    resumo:              string;
    totalEntradas:       number;
    totalSaidas:         number;
    valorTotalEntradas:  number;
    valorTotalSaidas:    number;
    alertas:             { tipo: 'warning' | 'info' | 'error'; mensagem: string }[];
    observacoes:         string[];
  } | null>(null);
  const [analiseCarregando, setAnaliseCarregando] = useState(false);
  const [analiseErro, setAnaliseErro]             = useState<string | null>(null);
  const [analiseBloqueado, setAnaliseBloqueado]   = useState(false);

  // ---------------------------------------------------------------------------
  // Upload e parse
  // ---------------------------------------------------------------------------

  const processarArquivos = useCallback(async (arquivos: File[]) => {
    setCarregando(true);
    setErroGlobal(null);

    let token: string;
    try {
      token = await getToken();
    } catch {
      setErroGlobal('Sessão expirada. Faça login novamente.');
      setCarregando(false);
      return;
    }

    const form = new FormData();
    for (const arquivo of arquivos) {
      form.append('arquivos', arquivo);
    }

    try {
      const res = await fetch('/api/v1/nfe/importar', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setErroGlobal(body.error ?? `Erro ${res.status} ao processar os arquivos.`);
        return;
      }

      const data = await res.json() as { resultados: ResultadoArquivo[] };
      // Acumula novos resultados sem apagar os anteriores
      setResultados((prev) => [...prev, ...data.resultados]);
    } catch (err) {
      setErroGlobal(err instanceof Error ? err.message : 'Erro de rede ao enviar os arquivos.');
    } finally {
      setCarregando(false);
    }
  }, [getToken]);

  // ---------------------------------------------------------------------------
  // Análise com IA
  // ---------------------------------------------------------------------------

  const analisarComIA = useCallback(async () => {
    if (resultados.length === 0) return;
    const nfes = resultados
      .filter((r) => r.ok && r.dados)
      .map((r) => ({
        numero:       r.dados!.numero,
        dataEmissao:  r.dados!.dataEmissao,
        emitente:     r.dados!.emitente,
        destinatario: r.dados!.destinatario,
        valorTotal:   r.dados!.valorTotal,
        impostos:     r.dados!.impostos,
        tipo:         r.dados!.tipo,
      }));

    if (nfes.length === 0) return;

    setAnaliseCarregando(true);
    setAnaliseErro(null);
    setAnaliseIa(null);

    let token: string;
    try {
      token = await getToken();
    } catch {
      setAnaliseErro('Sessão expirada. Faça login novamente.');
      setAnaliseCarregando(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/nfe/analisar', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nfes }),
      });
      const body = await res.json() as { analise?: typeof analiseIa; message?: string };
      if (res.status === 403 && body.message?.includes('Enterprise')) {
        setAnaliseBloqueado(true);
        return;
      }
      if (!res.ok) { setAnaliseErro(body.message ?? `Erro HTTP ${res.status}`); return; }
      setAnaliseIa(body.analise ?? null);
    } catch {
      setAnaliseErro('Erro de conexão. Tente novamente.');
    } finally {
      setAnaliseCarregando(false);
    }
  }, [resultados, getToken]);

  // ---------------------------------------------------------------------------
  // Estatísticas dos resultados
  // ---------------------------------------------------------------------------
  const totalOk     = resultados.filter((r) => r.ok).length;
  const totalErro   = resultados.filter((r) => !r.ok).length;

  const limparTudo = useCallback(() => {
    setResultados([]);
    setAnaliseIa(null);
    setAnaliseErro(null);
    setAnaliseBloqueado(false);
    setErroGlobal(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FileText size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Importar NF-e</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Faça upload de XMLs de Nota Fiscal Eletrônica para extrair dados fiscais
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Dropzone                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <Dropzone onArquivos={processarArquivos} carregando={carregando} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Erro global                                                          */}
      {/* ------------------------------------------------------------------ */}
      {erroGlobal && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">{erroGlobal}</p>
          <button onClick={() => setErroGlobal(null)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Resumo dos resultados                                                */}
      {/* ------------------------------------------------------------------ */}
      {resultados.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{resultados.length}</span> arquivo(s) processado(s)
          </div>
          {totalOk > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={14} />
              {totalOk} com sucesso
            </span>
          )}
          {totalErro > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle size={14} />
              {totalErro} com erro
            </span>
          )}
          <button
            onClick={limparTudo}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
          >
            <Trash2 size={12} />
            Limpar tudo
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tabela de resultados                                                 */}
      {/* ------------------------------------------------------------------ */}
      {resultados.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">NF número / Série</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Emitente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Destinatário</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Valor Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">ICMS</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {resultados.map((resultado, idx) => (
                  resultado.ok && resultado.dados ? (
                    <tr
                      key={idx}
                      onClick={() => setNfeSelecionada(resultado)}
                      className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                          {resultado.dados.numero || '—'}
                          {resultado.dados.serie ? <span className="text-gray-400"> / {resultado.dados.serie}</span> : null}
                          <ChevronRight size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors ml-0.5" />
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]" title={resultado.nomeArquivo}>
                          {resultado.nomeArquivo}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatarData(resultado.dados.dataEmissao)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate" title={resultado.dados.emitente.nome}>
                          {resultado.dados.emitente.nome || '—'}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {resultado.dados.emitente.cnpj ? formatarCNPJ(resultado.dados.emitente.cnpj) : ''}
                          {resultado.dados.emitente.uf ? ` · ${resultado.dados.emitente.uf}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate" title={resultado.dados.destinatario.nome}>
                          {resultado.dados.destinatario.nome || '—'}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {resultado.dados.destinatario.cnpjOuCpf
                            ? formatarCNPJ(resultado.dados.destinatario.cnpjOuCpf)
                            : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatarBRL(resultado.dados.valorTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatarBRL(resultado.dados.impostos.icms)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TipoBadge tipo={resultado.dados.tipo} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={idx} className="bg-red-50/50 dark:bg-red-950/20">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                          <AlertTriangle size={14} className="shrink-0" />
                          <span className="font-medium">{resultado.nomeArquivo}</span>
                          <span className="text-red-400 dark:text-red-500">—</span>
                          <span>{resultado.erro ?? 'Erro desconhecido'}</span>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Análise Fiscal com IA                                               */}
      {/* ------------------------------------------------------------------ */}
      {totalOk > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-violet-500" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Análise Fiscal com IA</h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Analise {totalOk} NF-e(s) importada(s) com inteligência artificial para identificar inconsistências e oportunidades.
              </p>
            </div>
            <button
              onClick={analisarComIA}
              disabled={analiseCarregando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {analiseCarregando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {analiseCarregando ? 'Analisando…' : 'Analisar com IA'}
            </button>
          </div>

          {/* Upgrade/locked */}
          {analiseBloqueado && (
            <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <Lock size={18} className="text-purple-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">Plano Enterprise necessário</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">A Análise IA de NF-e está disponível apenas no plano Enterprise.</p>
              </div>
            </div>
          )}

          {/* Erro */}
          {analiseErro && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{analiseErro}</p>
            </div>
          )}

          {/* Resultado */}
          {analiseIa && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">{analiseIa.resumo}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Entradas</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{analiseIa.totalEntradas}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{analiseIa.valorTotalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Saídas</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{analiseIa.totalSaidas}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{analiseIa.valorTotalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
              </div>
              {analiseIa.alertas.length > 0 && (
                <div className="space-y-2">
                  {analiseIa.alertas.map((a, i) => (
                    <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm
                      ${a.tipo === 'error' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                      : a.tipo === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                      : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'}`}>
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      {a.mensagem}
                    </div>
                  ))}
                </div>
              )}
              {analiseIa.observacoes.length > 0 && (
                <ul className="space-y-1">
                  {analiseIa.observacoes.map((obs, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                      <span className="text-violet-400 mt-0.5">•</span> {obs}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Estado vazio (antes de fazer upload)                                */}
      {/* ------------------------------------------------------------------ */}
      {resultados.length === 0 && !carregando && !erroGlobal && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-600">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum arquivo processado ainda.</p>
          <p className="text-xs mt-1">Arraste XMLs de NF-e para a área acima ou clique para selecionar.</p>
        </div>
      )}

      {/* Modal de detalhes */}
      {nfeSelecionada && nfeSelecionada.dados && (
        <ModalDetalheNFe
          resultado={nfeSelecionada}
          onFechar={() => setNfeSelecionada(null)}
        />
      )}
    </div>
  );
}
