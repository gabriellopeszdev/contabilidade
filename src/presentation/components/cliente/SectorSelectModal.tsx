'use client';

import { useState, useCallback } from 'react';
import {
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// SectorSelectModal
//
// Modal leve acionado após o cliente selecionar um arquivo no Dashboard.
// Envia o documento sem classificação; o contador categoriza depois.
// =============================================================================

interface Props {
  arquivo:   File;
  onFechar:  () => void;
  onSucesso: () => void;
}

export function SectorSelectModal({ arquivo, onFechar, onSucesso }: Props) {
  const { token } = useAuth();

  const [enviando, setEnviando] = useState(false);
  const [erro,     setErro]     = useState<string | null>(null);
  const [sucesso,  setSucesso]  = useState(false);

  const handleEnviar = useCallback(async () => {
    if (!token || enviando) return;
    setEnviando(true);
    setErro(null);

    try {
      const form = new FormData();
      form.append('arquivo', arquivo);

      const res  = await fetch('/api/v1/documentos/cliente-upload', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
      const body = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? `Erro HTTP ${res.status}`);

      setSucesso(true);
      setTimeout(onSucesso, 1200);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar documento.');
    } finally {
      setEnviando(false);
    }
  }, [arquivo, token, enviando, onSucesso]);

  const tamanhoStr = arquivo.size < 1024 * 1024
    ? `${(arquivo.size / 1024).toFixed(0)} KB`
    : `${(arquivo.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={!enviando ? onFechar : undefined}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Confirmar envio</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <FileText size={13} className="text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]" title={arquivo.name}>
                {arquivo.name}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">· {tamanhoStr}</span>
            </div>
          </div>
          <button
            onClick={onFechar}
            disabled={enviando}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800
                       transition-colors disabled:opacity-40 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-lg px-3 py-2.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
          <p className="text-xs text-sky-700 dark:text-sky-400">
            Seu contador fará a classificação do documento (Fiscal, Pessoal ou Contábil) após o envio.
          </p>
        </div>

        {/* Feedback de erro */}
        {erro && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <span className="text-xs text-red-700 dark:text-red-400">{erro}</span>
          </div>
        )}

        {/* Feedback de sucesso */}
        {sucesso && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              Documento enviado com sucesso. Seu contador já foi notificado.
            </span>
          </div>
        )}

        {/* Botão de envio */}
        <button
          type="button"
          onClick={handleEnviar}
          disabled={enviando || sucesso}
          className="w-full py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl
                     hover:bg-sky-700 active:bg-sky-800 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {enviando ? (
            <><Loader2 size={15} className="animate-spin" /> Enviando…</>
          ) : sucesso ? (
            <><CheckCircle2 size={15} /> Enviado!</>
          ) : (
            <><Upload size={15} /> Enviar documento</>
          )}
        </button>
      </div>
    </div>
  );
}
