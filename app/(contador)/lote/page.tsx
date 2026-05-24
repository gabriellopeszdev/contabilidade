'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Info,
} from 'lucide-react';

import { UploadLoteDropzone } from '../../../src/presentation/components/upload/UploadLoteDropzone';
import {
  ClienteCombobox,
  type ClienteResumo,
} from '../../../src/presentation/components/upload/ClienteCombobox';
import { useAuth } from '../../../src/presentation/hooks/useAuth';
import {
  useNotificacoes,
  type Notificacao,
} from '../../../src/presentation/hooks/useNotificacoes';
import type { ResultadoLote } from '../../../src/presentation/hooks/useUploadLote';

// =============================================================================
// Sub-componente: Toast de notificação
// =============================================================================

interface ToastProps {
  notificacao: Notificacao;
  onFechar:    () => void;
}

function Toast({ notificacao, onFechar }: ToastProps) {
  const icone =
    notificacao.tipo === 'novoDocumentoUpload' ? (
      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
    ) : (
      <Info          size={18} className="text-blue-500   shrink-0" />
    );

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700
                 p-4 pr-3 w-80 animate-in slide-in-from-right-full duration-300"
    >
      {icone}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
          {notificacao.tipo === 'novoDocumentoUpload' ? 'Upload concluído' : 'Documento visualizado'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
          {notificacao.mensagem}
        </p>
      </div>
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar notificação"
        className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
                   transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// =============================================================================
// Página: /lote — Upload de Documentos em Lote
// =============================================================================

export default function LotePage() {
  const { token, getToken, usuario } = useAuth();

  // -------------------------------------------------------------------------
  // Seleção de cliente (empresa destinatária)
  // -------------------------------------------------------------------------
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteResumo | null>(null);

  // -------------------------------------------------------------------------
  // Toasts de notificação local (feedback de upload)
  // -------------------------------------------------------------------------
  const [toasts, setToasts] = useState<Notificacao[]>([]);

  const onNovaNotificacao = useCallback((n: Notificacao) => {
    setToasts((prev) => [n, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== n.id));
    }, 6_000);
  }, []);

  useNotificacoes(token ?? undefined, onNovaNotificacao);

  // -------------------------------------------------------------------------
  // Callback de conclusão de upload
  // -------------------------------------------------------------------------
  const handleUploadConcluido = useCallback((resultado: ResultadoLote) => {
    if (resultado.totalFalhas === 0) return; // sucesso total já tem feedback no componente
    // Falhas parciais: o componente mostra visualmente, não precisamos de toast extra
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Upload de Documentos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Envio em lote de documentos fiscais</p>
      </div>

        {/* Card principal de upload */}
        <section
          aria-labelledby="titulo-upload"
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50">
              <Upload size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 id="titulo-upload" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Envio em Lote
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Selecione o cliente, o setor, o período de competência e os arquivos
              </p>
            </div>
          </div>

          {/* Seletor de Cliente */}
          <div className="mb-5">
            <ClienteCombobox
              getToken={getToken}
              value={clienteSelecionado}
              onSelect={setClienteSelecionado}
              disabled={false}
            />
          </div>

          <UploadLoteDropzone
            clienteId={clienteSelecionado?.id ?? null}
            clienteNome={clienteSelecionado?.nome}
            getToken={getToken}
            onUploadConcluido={handleUploadConcluido}
            setoresPermitidos={usuario?.setores}
          />
        </section>

        {/* Informações de suporte */}
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 flex gap-3">
          <AlertTriangle size={16} className="text-blue-500 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-700 space-y-0.5">
            <p className="font-semibold">Retenção obrigatória por lei</p>
            <p>
              Documentos fiscais devem ser retidos por no mínimo 5 anos conforme o{' '}
              <strong>CTN Art. 173</strong>. O sistema aplica retenção automática por setor.
            </p>
          </div>
        </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stack de Toasts (bottom-right)                                       */}
      {/* ------------------------------------------------------------------ */}
      <div
        aria-live="polite"
        aria-label="Notificações"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              notificacao={toast}
              onFechar={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            />
          </div>
        ))}
      </div>

    </div>
  );
}
