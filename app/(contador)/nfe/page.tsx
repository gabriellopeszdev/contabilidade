'use client';

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

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
// Página principal: /nfe — Importar NF-e
// =============================================================================

export default function NfePage() {
  const { getToken } = useAuth();

  const [carregando,   setCarregando]   = useState(false);
  const [resultados,   setResultados]   = useState<ResultadoArquivo[] | null>(null);
  const [erroGlobal,   setErroGlobal]   = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Upload e parse
  // ---------------------------------------------------------------------------

  const processarArquivos = useCallback(async (arquivos: File[]) => {
    setCarregando(true);
    setErroGlobal(null);
    setResultados(null);

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
      setResultados(data.resultados);
    } catch (err) {
      setErroGlobal(err instanceof Error ? err.message : 'Erro de rede ao enviar os arquivos.');
    } finally {
      setCarregando(false);
    }
  }, [getToken]);

  // ---------------------------------------------------------------------------
  // Estatísticas dos resultados
  // ---------------------------------------------------------------------------
  const totalOk     = resultados?.filter((r) => r.ok).length  ?? 0;
  const totalErro   = resultados?.filter((r) => !r.ok).length ?? 0;

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
      {resultados && (
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
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tabela de resultados                                                 */}
      {/* ------------------------------------------------------------------ */}
      {resultados && resultados.length > 0 && (
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
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {resultado.dados.numero || '—'}
                          {resultado.dados.serie ? <span className="text-gray-400"> / {resultado.dados.serie}</span> : null}
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
      {/* Estado vazio (antes de fazer upload)                                */}
      {/* ------------------------------------------------------------------ */}
      {!resultados && !carregando && !erroGlobal && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-600">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum arquivo processado ainda.</p>
          <p className="text-xs mt-1">Arraste XMLs de NF-e para a área acima ou clique para selecionar.</p>
        </div>
      )}
    </div>
  );
}
