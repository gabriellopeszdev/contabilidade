'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  Users,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

interface NpsResposta {
  id:         string;
  userId:     string;
  userType:   string;
  score:      number;
  comentario: string | null;
  createdAt:  string;
}

function classScore(score: number): { label: string; cor: string; bg: string } {
  if (score <= 6) return { label: 'Detrator',  cor: 'text-red-400',    bg: 'bg-red-900/30 border-red-700/40' };
  if (score <= 8) return { label: 'Neutro',    cor: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700/40' };
  return              { label: 'Promotor',  cor: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-700/40' };
}

function ScoreBar({ score, total }: { score: number; total: number }) {
  const { label, cor, bg } = classScore(score);
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-6 text-right text-slate-300 font-mono">{score}</span>
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cor.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-slate-400">{score}</span>
    </div>
  );
}

export default function FeedbacksPage() {
  const { token } = useAuth();

  const [respostas,   setRespostas]   = useState<NpsResposta[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [media,       setMedia]       = useState<number | null>(null);
  const [distribuicao, setDistribuicao] = useState<Record<number, number>>({});
  const [loading,     setLoading]     = useState(true);
  const [erro,        setErro]        = useState<string | null>(null);

  const [userType, setUserType] = useState('');

  const LIMIT = 20;

  const carregar = useCallback(async (p: number, ut = userType) => {
    if (!token) return;
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (ut) params.set('userType', ut);
      const res = await fetch(`/api/v1/admin/nps?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        respostas: NpsResposta[];
        total: number;
        page: number;
        totalPages: number;
        media: number | null;
        distribuicao: Record<number, number>;
      };
      setRespostas(data.respostas ?? []);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setMedia(data.media);
      setDistribuicao(data.distribuicao ?? {});
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [token, userType]);

  useEffect(() => { carregar(1); }, [carregar]);

  const totalRespostas = Object.values(distribuicao).reduce((a, b) => a + b, 0);
  const promotores  = Array.from({ length: 3 }, (_, i) => distribuicao[i + 9] ?? 0).reduce((a, b) => a + b, 0) + (distribuicao[8] ?? 0);
  const detratores  = Array.from({ length: 7 }, (_, i) => distribuicao[i] ?? 0).reduce((a, b) => a + b, 0);
  const npsScore    = totalRespostas > 0
    ? Math.round(((promotores - detratores) / totalRespostas) * 100)
    : null;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Feedbacks NPS</h1>
        <p className="text-sm text-slate-400 mt-0.5">Avaliações enviadas por contadores e clientes via modal NPS.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400 flex items-center gap-1.5"><Users size={12} /> Total de Respostas</p>
          <p className="text-2xl font-bold text-white">{total.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400 flex items-center gap-1.5"><Star size={12} /> Nota Média</p>
          <p className="text-2xl font-bold text-white">{media !== null ? media.toFixed(1) : '—'}<span className="text-sm text-slate-500">/10</span></p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400 flex items-center gap-1.5"><TrendingUp size={12} /> NPS Score</p>
          <p className={`text-2xl font-bold ${npsScore !== null && npsScore >= 50 ? 'text-emerald-400' : npsScore !== null && npsScore >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            {npsScore !== null ? (npsScore > 0 ? `+${npsScore}` : String(npsScore)) : '—'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-400 flex items-center gap-1.5"><MessageSquare size={12} /> Com Comentário</p>
          <p className="text-2xl font-bold text-white">
            {respostas.filter(r => r.comentario).length}
            <span className="text-sm text-slate-500"> / {respostas.length}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

        {/* Tabela */}
        <div className="space-y-4">

          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={userType}
                onChange={(e) => { setUserType(e.target.value); carregar(1, e.target.value); }}
                className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg pl-8 pr-8 py-2 focus:outline-none focus:border-violet-500 appearance-none [color-scheme:dark]"
              >
                <option value="">Todos os tipos</option>
                <option value="CONTADOR">Contadores</option>
                <option value="CLIENTE">Clientes</option>
              </select>
            </div>
          </div>

          {erro && (
            <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl px-5 py-4">
              <AlertCircle size={16} />
              <span className="text-sm">{erro}</span>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-100">Respostas</h2>
              {!loading && <span className="text-xs text-slate-500">{total.toLocaleString('pt-BR')} registros</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Data</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Tipo</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-slate-400">Nota</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-slate-400">Classificação</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Comentário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr><td colSpan={5} className="py-12 text-center"><Loader2 size={22} className="animate-spin text-violet-400 mx-auto" /></td></tr>
                  ) : respostas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <MessageSquare size={28} className="text-slate-700 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Nenhum feedback encontrado.</p>
                      </td>
                    </tr>
                  ) : (
                    respostas.map((r) => {
                      const cls = classScore(r.score);
                      return (
                        <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5 text-xs text-slate-400 font-mono whitespace-nowrap">
                            {new Date(r.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${r.userType === 'CONTADOR' ? 'text-violet-400 bg-violet-900/30 border-violet-700/40' : 'text-cyan-400 bg-cyan-900/30 border-cyan-700/40'}`}>
                              {r.userType === 'CONTADOR' ? 'Contador' : 'Cliente'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="text-lg font-bold text-white">{r.score}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${cls.bg} ${cls.cor}`}>
                              {cls.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-400 max-w-[280px]">
                            {r.comentario
                              ? <span className="italic">&ldquo;{r.comentario}&rdquo;</span>
                              : <span className="text-slate-600">—</span>
                            }
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => carregar(page - 1)} disabled={page <= 1 || loading}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <button onClick={() => carregar(page + 1)} disabled={page >= totalPages || loading}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Distribuição de notas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 self-start">
          <h3 className="text-sm font-semibold text-slate-100">Distribuição de Notas</h3>
          <div className="space-y-2">
            {Array.from({ length: 11 }, (_, i) => 10 - i).map((score) => {
              const count = distribuicao[score] ?? 0;
              const maxCount = Math.max(...Object.values(distribuicao), 1);
              const pct = Math.round((count / maxCount) * 100);
              const cls = classScore(score);
              return (
                <div key={score} className="flex items-center gap-3 text-xs">
                  <span className="w-4 text-right text-slate-400 font-mono shrink-0">{score}</span>
                  <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cls.cor.replace('text-', 'bg-')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-slate-500 shrink-0">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />Promotores (9–10)</span>
              <span className="font-mono text-emerald-400">{totalRespostas > 0 ? Math.round((Array.from({ length: 2 }, (_, i) => distribuicao[i + 9] ?? 0).reduce((a, b) => a + b, 0) / totalRespostas) * 100) : 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />Neutros (7–8)</span>
              <span className="font-mono text-yellow-400">{totalRespostas > 0 ? Math.round(([7, 8].reduce((a, s) => a + (distribuicao[s] ?? 0), 0) / totalRespostas) * 100) : 0}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />Detratores (0–6)</span>
              <span className="font-mono text-red-400">{totalRespostas > 0 ? Math.round((detratores / totalRespostas) * 100) : 0}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
