'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, AlertCircle, CheckCircle2, Clock,
  Zap, Hourglass, Ban, ChevronDown, ChevronRight,
  RotateCcw, Loader2, Database,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface JobCounts {
  active:    number;
  waiting:   number;
  completed: number;
  failed:    number;
  delayed:   number;
  paused:    number;
}

interface JobInfo {
  id:           string;
  name:         string;
  tipo:         string;
  failedReason: string | null;
  stacktrace:   string | null;
  finishedOn:   number | null;
  processedOn:  number | null;
  timestamp:    number | null;
  attemptsMade: number;
  duration:     number | null;
}

interface QueueData {
  fila:      string;
  counts:    JobCounts;
  failed:    JobInfo[];
  active:    JobInfo[];
  completed: JobInfo[];
  delayed:   JobInfo[];
}

// =============================================================================
// Helpers
// =============================================================================

function fmtDuracao(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function fmtData(ts: number | null): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(ts));
}

function fmtAgo(ts: number | null): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m atrás`;
  return `${Math.floor(diff / 3_600_000)}h atrás`;
}

function labelTipo(tipo: string): string {
  const map: Record<string, string> = {
    PARSEAR_XML_NFE:              'Parsear XML NF-e',
    EXTRAIR_TEXTO_PDF:            'Extrair Texto PDF',
    GERAR_RELATORIO_MENSAL:       'Relatório Mensal',
    ENVIAR_EMAIL_LOTE:            'E-mail em Lote',
    LEMBRETE_BOLETO_VENCIMENTO:   'Lembrete Boleto',
    'verificar-lembretes':        'Verificar Lembretes',
    'gerar-obrigacoes-recorrentes': 'Gerar Obrigações',
  };
  return map[tipo] ?? tipo;
}

// =============================================================================
// Sub-componentes
// =============================================================================

function StatusCard({
  label, count, icon: Icon, colorClass,
}: {
  label: string; count: number; icon: React.ElementType; colorClass: string;
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border bg-slate-900 ${colorClass}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass.replace('border-', 'bg-').replace('/40', '/20')}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{count.toLocaleString('pt-BR')}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function StacktraceRow({ job }: { job: JobInfo }) {
  const [aberto, setAberto] = useState(false);
  if (!job.stacktrace) return null;
  return (
    <tr className="bg-slate-950/60">
      <td colSpan={5} className="px-4 py-2">
        <button
          onClick={() => setAberto(!aberto)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-1"
        >
          {aberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Stack trace
        </button>
        {aberto && (
          <pre className="text-[10px] text-red-400/80 bg-red-950/20 rounded p-2 overflow-x-auto max-h-40 border border-red-900/30 whitespace-pre-wrap break-all">
            {job.stacktrace}
          </pre>
        )}
      </td>
    </tr>
  );
}

// =============================================================================
// Página principal
// =============================================================================

const REFRESH_INTERVAL = 10_000;

export default function FilasPage() {
  const { token } = useAuth();

  const [data,        setData]        = useState<QueueData | null>(null);
  const [erro,        setErro]        = useState<string | null>(null);
  const [carregando,  setCarregando]  = useState(true);
  const [retryId,     setRetryId]     = useState<string | null>(null);
  const [countdown,   setCountdown]   = useState(REFRESH_INTERVAL / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/admin/queues', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  // Auto-refresh
  useEffect(() => {
    carregar();
    const interval = setInterval(() => {
      carregar();
      setCountdown(REFRESH_INTERVAL / 1000);
    }, REFRESH_INTERVAL);

    const countdownInterval = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1));
    }, 1000);

    timerRef.current = interval;
    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, [carregar]);

  const handleRetry = async (jobId: string) => {
    if (!token || retryId) return;
    setRetryId(jobId);
    try {
      const res = await fetch(`/api/v1/admin/queues/${jobId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao reenviar job');
    } finally {
      setRetryId(null);
    }
  };

  const handleRefreshManual = () => {
    setCarregando(true);
    setCountdown(REFRESH_INTERVAL / 1000);
    if (timerRef.current) { clearInterval(timerRef.current); }
    timerRef.current = setInterval(() => {
      carregar();
      setCountdown(REFRESH_INTERVAL / 1000);
    }, REFRESH_INTERVAL);
    carregar();
  };

  // --------------------------------------------------------------------------
  // Loading state
  // --------------------------------------------------------------------------

  if (carregando && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Error state
  // --------------------------------------------------------------------------

  if (erro && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-400">{erro}</p>
        <button
          onClick={handleRefreshManual}
          className="px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const { counts, failed, active, completed, delayed, fila } = data!;

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-violet-400" />
            <span className="text-xs text-slate-500 font-mono">{fila}</span>
          </div>
          <h1 className="text-xl font-bold text-white">Monitoramento de Filas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Jobs em processamento assíncrono via BullMQ + Redis</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600">
            {carregando
              ? 'Atualizando…'
              : `Atualiza em ${countdown}s`}
          </span>
          <button
            onClick={handleRefreshManual}
            disabled={carregando}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatusCard label="Ativos"     count={counts.active}    icon={Zap}          colorClass="border-violet-500/40 text-violet-400" />
        <StatusCard label="Aguardando" count={counts.waiting}   icon={Hourglass}    colorClass="border-blue-500/40 text-blue-400"    />
        <StatusCard label="Concluídos" count={counts.completed} icon={CheckCircle2} colorClass="border-emerald-500/40 text-emerald-400" />
        <StatusCard label="Falhas"     count={counts.failed}    icon={AlertCircle}  colorClass="border-red-500/40 text-red-400"      />
        <StatusCard label="Agendados"  count={counts.delayed}   icon={Clock}        colorClass="border-amber-500/40 text-amber-400"  />
      </div>

      {/* Jobs ativos */}
      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            Em processamento ({active.length})
          </h2>
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Job</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Iniciado</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Tentativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {active.map((job) => (
                  <tr key={job.id} className="bg-slate-900 hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <span className="text-violet-300 font-medium">{labelTipo(job.tipo)}</span>
                      <span className="ml-2 text-[10px] text-slate-600 font-mono">#{job.id}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{fmtAgo(job.processedOn)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{job.attemptsMade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Jobs com falha */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400" />
          Falhas recentes ({failed.length})
        </h2>
        {failed.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-8 text-center">
            <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Nenhum job com falha.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Job</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 hidden md:table-cell">Erro</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 hidden sm:table-cell">Tentativas</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 hidden lg:table-cell">Falhou em</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {failed.map((job) => (
                  <>
                    <tr key={job.id} className="bg-slate-900 hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <span className="text-red-300 font-medium">{labelTipo(job.tipo)}</span>
                        <span className="ml-2 text-[10px] text-slate-600 font-mono">#{job.id}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-slate-400 line-clamp-2 max-w-xs">
                          {job.failedReason ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-amber-400">{job.attemptsMade}×</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">
                        {fmtData(job.finishedOn)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={retryId === job.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 transition-colors disabled:opacity-50"
                        >
                          {retryId === job.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <RotateCcw size={11} />}
                          Reenviar
                        </button>
                      </td>
                    </tr>
                    {job.stacktrace && <StacktraceRow key={`st-${job.id}`} job={job} />}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Jobs agendados (delayed) */}
      {delayed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Clock size={14} className="text-amber-400" />
            Agendados ({delayed.length})
          </h2>
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Job</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Agendado para</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {delayed.map((job) => (
                  <tr key={job.id} className="bg-slate-900 hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <span className="text-amber-300 font-medium">{labelTipo(job.tipo)}</span>
                      <span className="ml-2 text-[10px] text-slate-600 font-mono">#{job.id}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtData(job.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Jobs concluídos recentes */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          Concluídos recentes ({completed.length})
        </h2>
        {completed.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-8 text-center">
            <Ban size={24} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum job concluído registrado.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Job</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 hidden sm:table-cell">Duração</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400">Concluído</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {completed.map((job) => (
                  <tr key={job.id} className="bg-slate-900 hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <span className="text-emerald-300 font-medium">{labelTipo(job.tipo)}</span>
                      <span className="ml-2 text-[10px] text-slate-600 font-mono">#{job.id}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-400 tabular-nums">
                      {fmtDuracao(job.duration)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {fmtAgo(job.finishedOn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
