'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCode2,
  Trash2,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// EnvioLoteModal
//
// Exibe a lista de arquivos selecionados no Dropzone e confirma o envio.
// Envia os arquivos sequencialmente e exibe o progresso por arquivo.
// O setor é definido pelo contador após o envio.
// =============================================================================

type EstadoArquivo = 'aguardando' | 'enviando' | 'sucesso' | 'erro';

interface ArquivoItem {
  file:   File;
  estado: EstadoArquivo;
  erro?:  string;
}

interface Props {
  arquivos:     File[];
  categoriaId?: string;
  onFechar:     () => void;
  onSucesso:    () => void;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EnvioLoteModal({ arquivos, categoriaId, onFechar, onSucesso }: Props) {
  const { token } = useAuth();

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modalRef.current) modalRef.current.focus();
  }, []);

  const [itens,    setItens]    = useState<ArquivoItem[]>(
    () => arquivos.map((file) => ({ file, estado: 'aguardando' })),
  );
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const removerArquivo = useCallback((idx: number) => {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const totalSucesso = itens.filter((i) => i.estado === 'sucesso').length;
  const totalErro    = itens.filter((i) => i.estado === 'erro').length;
  const totalAtivos  = itens.length;

  const handleEnviar = useCallback(async () => {
    if (!token || itens.length === 0) return;
    setEnviando(true);

    const atualizarEstado = (idx: number, patch: Partial<ArquivoItem>) => {
      setItens((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    };

    for (let i = 0; i < itens.length; i++) {
      if (itens[i].estado === 'sucesso') continue; // skip já enviados (retry)

      atualizarEstado(i, { estado: 'enviando', erro: undefined });

      try {
        const form = new FormData();
        form.append('arquivo', itens[i].file);
        if (categoriaId) form.append('categoriaId', categoriaId);

        const res  = await fetch('/api/v1/documentos/cliente-upload', {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}` },
          body:    form,
        });
        const body = await res.json().catch(() => ({})) as { message?: string };

        if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
        atualizarEstado(i, { estado: 'sucesso' });
      } catch (err) {
        atualizarEstado(i, {
          estado: 'erro',
          erro:   err instanceof Error ? err.message : 'Falha no envio.',
        });
      }
    }

    setEnviando(false);
    setConcluido(true);
  }, [itens, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!enviando ? onFechar : undefined}
        onKeyDown={(e) => { if (e.key === 'Escape') onFechar(); }}
      />

      {/* Painel */}
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-envio-lote-titulo"
        className="relative w-full sm:max-w-lg bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700
        flex flex-col max-h-[92dvh] rounded-t-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            <h3 id="modal-envio-lote-titulo" className="text-base font-bold text-gray-900 dark:text-gray-100">Confirmar envio</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {totalAtivos} arquivo{totalAtivos !== 1 ? 's' : ''} selecionado{totalAtivos !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onFechar}
            disabled={enviando}
            aria-label="Fechar modal"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800
              disabled:opacity-40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Lista de arquivos */}
          <div className="space-y-1.5">
            {!concluido && (
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
                Arquivos
              </p>
            )}
            {itens.map((item, idx) => {
              const isPDF = item.file.name.toLowerCase().endsWith('.pdf');
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors
                    ${item.estado === 'sucesso'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                      : item.estado === 'erro'
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : item.estado === 'enviando'
                          ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                >
                  {/* Ícone */}
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                    flex items-center justify-center">
                    {isPDF
                      ? <FileText  size={14} className="text-red-500" />
                      : <FileCode2 size={14} className="text-sky-500" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{item.file.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{formatarTamanho(item.file.size)}</p>
                    {item.erro && (
                      <p className="text-[10px] text-red-600 mt-0.5">{item.erro}</p>
                    )}
                  </div>

                  {/* Status / Remover */}
                  <div className="shrink-0">
                    {item.estado === 'aguardando' && !enviando && (
                      <button
                        onClick={() => removerArquivo(idx)}
                        className="p-1 rounded text-gray-300 hover:text-red-500 transition-colors"
                        title="Remover arquivo"
                        aria-label={`Remover ${item.file.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {item.estado === 'enviando' && (
                      <Loader2 size={16} className="animate-spin text-sky-500" aria-hidden="true" />
                    )}
                    {item.estado === 'sucesso' && (
                      <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />
                    )}
                    {item.estado === 'erro' && (
                      <AlertCircle size={16} className="text-red-500" aria-hidden="true" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumo pós-envio */}
          {concluido && (
            <div className={`rounded-xl p-4 text-sm font-semibold text-center
              ${totalErro === 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
              }`}
            >
              {totalErro === 0
                ? `${totalSucesso} arquivo${totalSucesso !== 1 ? 's' : ''} enviado${totalSucesso !== 1 ? 's' : ''} com sucesso!`
                : `${totalSucesso} enviado${totalSucesso !== 1 ? 's' : ''} · ${totalErro} com erro — você pode reenviar os arquivos com falha.`
              }
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex items-center gap-3">
          {concluido ? (
            <button
              onClick={totalErro === 0 ? onSucesso : onFechar}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl
                hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
            >
              {totalErro > 0 ? 'Fechar' : 'Concluído'}
            </button>
          ) : (
            <>
              <button
                onClick={onFechar}
                disabled={enviando}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
                  rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviar}
                disabled={enviando || itens.length === 0}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl
                  hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {enviando
                  ? <><Loader2 size={15} className="animate-spin" /> Enviando…</>
                  : <><Upload size={15} /> Enviar</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
