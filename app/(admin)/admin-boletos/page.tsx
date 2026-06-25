'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

interface Boleto {
  id:             string;
  clienteNome:    string;
  clienteCnpj:    string;
  escritorioNome: string;
  escritorioId:   string;
  valor:          number;
  status:         string;
  tipoPagamento:  string;
  mesReferencia:  string;
  vencimento:     string;
  asaasId:        string | null;
  createdAt:      string;
}

const STATUS_COR: Record<string, string> = {
  PENDENTE:  'text-amber-400 bg-amber-900/30 border-amber-700/40',
  PAGO:      'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
  VENCIDO:   'text-red-400 bg-red-900/30 border-red-700/40',
  CANCELADO: 'text-slate-400 bg-slate-800 border-slate-700/40',
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente', PAGO: 'Pago', VENCIDO: 'Vencido', CANCELADO: 'Cancelado',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminBoletosPage() {
  const { token } = useAuth();

  const [boletos,    setBoletos]    = useState<Boleto[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const LIMIT = 20;

  const carregar = useCallback(async (p: number, s = search, st = status) => {
    if (!token) return;
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (s)  params.set('search', s);
      if (st) params.set('status', st);

      const res = await fetch(`/api/v1/admin/boletos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { boletos: Boleto[]; total: number; page: number; totalPages: number };
      setBoletos(data.boletos ?? []);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [token, search, status]);

  useEffect(() => { carregar(1); }, [carregar]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    carregar(1, search, status);
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Todos os Boletos</h1>
        <p className="text-sm text-slate-400 mt-0.5">Visualize boletos de todos os escritórios da plataforma.</p>
      </div>

      {/* Filtros */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por cliente, CNPJ ou escritório…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-violet-500"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); carregar(1, search, e.target.value); }}
            className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg pl-9 pr-8 py-2.5 focus:outline-none focus:border-violet-500 appearance-none [color-scheme:dark]"
          >
            <option value="">Todos os status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="PAGO">Pago</option>
            <option value="VENCIDO">Vencido</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        <button type="submit" className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
          Buscar
        </button>
      </form>

      {erro && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{erro}</span>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-100">Boletos</h2>
          {!loading && <span className="text-xs text-slate-500">{total.toLocaleString('pt-BR')} registros</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Cliente</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Escritório</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Referência</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-400">Valor</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-400">Status</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-400">Tipo</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-400">Vencimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><Loader2 size={22} className="animate-spin text-violet-400 mx-auto" /></td></tr>
              ) : boletos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Receipt size={28} className="text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Nenhum boleto encontrado.</p>
                  </td>
                </tr>
              ) : (
                boletos.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-slate-100 font-medium truncate max-w-[180px]">{b.clienteNome}</p>
                      <p className="text-xs text-slate-500 font-mono">{b.clienteCnpj}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 truncate max-w-[160px]">{b.escritorioNome}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{b.mesReferencia}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-100">{fmt(b.valor)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-[11px] font-medium border px-2 py-0.5 rounded-full ${STATUS_COR[b.status] ?? STATUS_COR.CANCELADO}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-[11px] text-slate-500 font-mono">{b.tipoPagamento}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-400">
                      {new Date(b.vencimento).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
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
  );
}
