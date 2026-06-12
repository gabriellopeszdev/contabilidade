'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

interface WebhookLog {
  id:          string;
  eventKey:    string;
  processedAt: string;
}

function eventColor(evType: string): string {
  if (evType.includes('RECEIVED') || evType.includes('CONFIRMED')) return 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40';
  if (evType.includes('OVERDUE'))   return 'text-amber-400 bg-amber-900/30 border-amber-700/40';
  if (evType.includes('DELETED') || evType.includes('REFUNDED') || evType.includes('CHARGEBACK')) return 'text-red-400 bg-red-900/30 border-red-700/40';
  if (evType.includes('REFUND'))    return 'text-orange-400 bg-orange-900/30 border-orange-700/40';
  if (evType.includes('SUBSCRIPTION')) return 'text-violet-400 bg-violet-900/30 border-violet-700/40';
  if (evType.includes('CREATED'))   return 'text-sky-400 bg-sky-900/30 border-sky-700/40';
  return 'text-slate-400 bg-slate-800 border-slate-700/40';
}

export default function WebhookLogsPage() {
  const { token } = useAuth();

  const [logs,       setLogs]       = useState<WebhookLog[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);

  const LIMIT = 50;

  const carregar = useCallback(async (p: number) => {
    if (!token) return;
    setLoading(true);
    setErro(null);
    try {
      const res  = await fetch(`/api/v1/admin/webhook-logs?page=${p}&limit=${LIMIT}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { logs: WebhookLog[]; total: number; page: number; totalPages: number };
      setLogs(data.logs ?? []);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { carregar(1); }, [carregar]);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Log de Webhooks</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Eventos recebidos do Asaas — cada evento é processado no máximo uma vez (idempotência).
          </p>
        </div>
        {!loading && (
          <span className="text-xs text-slate-500">{total.toLocaleString('pt-BR')} eventos</span>
        )}
      </div>

      {erro && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{erro}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-400">Evento</th>
              <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-400">ID do Recurso</th>
              <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-slate-400">Recebido em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center">
                  <div role="status" className="flex flex-col items-center gap-2">
                    <Loader2 size={22} className="animate-spin text-violet-400 mx-auto" />
                    <span className="sr-only">Carregando...</span>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-12 text-center">
                  <Activity size={28} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Nenhum evento recebido ainda.</p>
                  <p className="text-xs text-slate-600 mt-1">Configure o webhook no painel Asaas para começar a receber eventos.</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const colonIdx  = log.eventKey.indexOf(':');
                const evType    = colonIdx >= 0 ? log.eventKey.slice(0, colonIdx) : log.eventKey;
                const resourceId = colonIdx >= 0 ? log.eventKey.slice(colonIdx + 1) : '—';

                return (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-mono font-semibold border px-2 py-0.5 rounded ${eventColor(evType)}`}>
                        {evType}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{resourceId}</td>
                    <td className="px-5 py-3 text-right text-xs text-slate-500">
                      {new Date(log.processedAt).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => carregar(page - 1)}
              disabled={page <= 1 || loading}
              aria-label="Página anterior"
              className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => carregar(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Próxima página"
              className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
