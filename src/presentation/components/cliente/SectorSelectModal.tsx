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
// Modal leve acionado após o cliente soltar um arquivo na dropzone do Dashboard.
// Pede apenas o setor de destino e envia o documento.
// Mantém estado mínimo — sem recriar toda a UI do UploadClienteModal.
// =============================================================================

type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL';

interface Props {
  arquivo:       File;
  onFechar:      () => void;
  onSucesso:     () => void;
  setorInicial?: SetorTipo;
}

const SETORES: {
  value:  SetorTipo;
  label:  string;
  desc:   string;
  ring:   string;
  active: string;
}[] = [
  {
    value:  'FISCAL',
    label:  'Fiscal',
    desc:   'NF, DANFE, DARF, DAS',
    ring:   'ring-indigo-300',
    active: 'border-indigo-400 bg-indigo-50 text-indigo-800 ring-2',
  },
  {
    value:  'PESSOAL',
    label:  'Pessoal',
    desc:   'RG, CPF, comprovantes',
    ring:   'ring-violet-300',
    active: 'border-violet-400 bg-violet-50 text-violet-800 ring-2',
  },
  {
    value:  'CONTABIL',
    label:  'Contábil',
    desc:   'Balanços, DRE, extratos',
    ring:   'ring-teal-300',
    active: 'border-teal-400 bg-teal-50 text-teal-800 ring-2',
  },
];

export function SectorSelectModal({ arquivo, onFechar, onSucesso, setorInicial }: Props) {
  const { token } = useAuth();

  const [setor,    setSetor]    = useState<SetorTipo>(setorInicial ?? 'FISCAL');
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
      form.append('setor',   setor);

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
  }, [arquivo, setor, token, enviando, onSucesso]);

  const tamanhoStr = arquivo.size < 1024 * 1024
    ? `${(arquivo.size / 1024).toFixed(0)} KB`
    : `${(arquivo.size / (1024 * 1024)).toFixed(1)} MB`;

  const setorAtual = SETORES.find((s) => s.value === setor)!;

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
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Para qual setor?</h3>
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

        {/* Seletor de setor */}
        <div className="grid grid-cols-3 gap-2">
          {SETORES.map((s) => {
            const selecionado = setor === s.value;
            return (
              <button
                key={s.value}
                type="button"
                disabled={enviando || sucesso}
                onClick={() => setSetor(s.value)}
                className={`
                  rounded-xl border-2 px-2 py-3 text-center transition-all
                  disabled:opacity-50 focus-visible:outline-none
                  ${selecionado
                    ? s.active
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <p className="text-sm font-bold leading-tight">{s.label}</p>
                <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{s.desc}</p>
              </button>
            );
          })}
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
              Enviado para <strong>{setorAtual.label}</strong>. Seu contador já foi notificado!
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
            <><Upload size={15} /> Enviar para {setorAtual.label}</>
          )}
        </button>
      </div>
    </div>
  );
}
