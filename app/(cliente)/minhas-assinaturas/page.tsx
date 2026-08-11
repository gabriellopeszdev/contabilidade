'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  FileCheck2,
  PenLine,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  History,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

interface AssinaturaItem {
  id: string;
  status: 'PENDENTE' | 'ASSINADO' | 'RECUSADO' | 'EXPIRADO';
  documentoId: string;
  documentoNome: string;
  documentoTipo: string;
  linkAssinatura?: string;
  tokenAssinatura: string;
  expiresAt: string;
  assinadoAt: string | null;
  createdAt: string;
  motivoRecusa: string | null;
  temComprovante: boolean;
}

const STATUS_CORES = {
  PENDENTE: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Pendente' },
  ASSINADO: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Assinado' },
  RECUSADO: { badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Recusado' },
  EXPIRADO: { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', label: 'Expirado' },
};

function tempoRestante(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (dias > 0) return `Expira em ${dias}d ${horas}h`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `Expira em ${horas}h ${mins}m`;
}

type TabAtiva = 'pendentes' | 'historico';

export default function AssinaturasPage() {
  const { token } = useAuth();

  const inputRef = useRef<HTMLInputElement>(null);
  const [assinaturas, setAssinaturas] = useState<AssinaturaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabAtiva, setTabAtiva] = useState<TabAtiva>('pendentes');
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  const mostrarToast = (tipo: 'sucesso' | 'erro', msg: string) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const carregarAssinaturas = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/cliente/assinaturas', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAssinaturas(data.assinaturas ?? data.items ?? []);
    } catch {
      // silencia
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { carregarAssinaturas(); }, [carregarAssinaturas]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const res = await fetch('/api/v1/cliente/assinaturas', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Erro ao enviar o documento.');
      }
      mostrarToast('sucesso', 'Documento recebido! Seu contador será notificado.');
      carregarAssinaturas();
    } catch (err: any) {
      mostrarToast('erro', err.message ?? 'Não foi possível enviar o documento.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const pendentes = assinaturas.filter((a) => a.status === 'PENDENTE');
  const historico = assinaturas.filter((a) => a.status !== 'PENDENTE');
  const totalAssinados = assinaturas.filter((a) => a.status === 'ASSINADO').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assinaturas</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Documentos para assinar e comprovantes enviados
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 px-2 sm:px-4 py-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendentes.length}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Pendentes</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 px-2 sm:px-4 py-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalAssinados}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Assinados</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 px-2 sm:px-4 py-4 text-center">
          <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{assinaturas.length}</p>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">Total</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setTabAtiva('pendentes')}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150
            ${tabAtiva === 'pendentes'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
        >
          <Clock size={14} />
          Pendentes
          {pendentes.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {pendentes.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTabAtiva('historico')}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-150
            ${tabAtiva === 'historico'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
        >
          <History size={14} />
          Histórico
        </button>
      </div>

      {/* Conteúdo das tabs */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tabAtiva === 'pendentes' ? (
        <div className="space-y-3">
          {pendentes.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <FileCheck2 size={36} className="text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma assinatura pendente</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Quando seu contador solicitar uma assinatura, ela aparecerá aqui.
              </p>
            </div>
          ) : (
            pendentes.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 p-4 flex items-center gap-3 sm:gap-4"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">
                    {item.documentoNome}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    {tempoRestante(item.expiresAt)}
                  </p>
                </div>
                <span className={`hidden sm:inline-flex shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CORES.PENDENTE.badge}`}>
                  {STATUS_CORES.PENDENTE.label}
                </span>
                {item.linkAssinatura ? (
                  <a
                    href={item.linkAssinatura}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors"
                  >
                    <PenLine size={13} />
                    Assinar agora
                  </a>
                ) : (
                  <span className="shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-semibold cursor-not-allowed">
                    <PenLine size={13} />
                    Assinar
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {historico.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <History size={36} className="text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhum histórico ainda</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Documentos assinados, recusados ou expirados aparecerão aqui.
              </p>
            </div>
          ) : (
            historico.map((item) => {
              const cores = STATUS_CORES[item.status];
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <FileText size={20} className="text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">
                      {item.documentoNome}
                    </p>
                    {item.status === 'ASSINADO' && item.assinadoAt && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Assinado em {new Date(item.assinadoAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                        })}
                      </p>
                    )}
                    {item.status === 'RECUSADO' && item.motivoRecusa && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate">
                        {item.motivoRecusa}
                      </p>
                    )}
                    {item.status === 'EXPIRADO' && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Expirou em {new Date(item.expiresAt).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full ${cores.badge}`}>
                    {cores.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Seção de envio de comprovante */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-primary/20 dark:border-primary/30 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/10 flex items-center justify-center shrink-0">
            <Upload size={18} className="text-primary dark:text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Enviar documento assinado</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Assinou fisicamente? Envie o PDF digitalizado para seu contador.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {enviando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload size={15} />
              Selecionar PDF assinado
            </>
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm" style={{ animation: 'fadeInUp 0.3s ease both' }}>
          <div
            className={`flex items-start gap-3 rounded-xl shadow-xl border p-4 pr-3 bg-white dark:bg-gray-900
              ${toast.tipo === 'sucesso'
                ? 'border-emerald-200 dark:border-emerald-800'
                : 'border-red-200 dark:border-red-800'
              }`}
          >
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            }
            <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{toast.msg}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
