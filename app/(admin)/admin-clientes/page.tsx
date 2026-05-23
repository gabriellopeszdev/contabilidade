'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle,
} from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

interface Escritorio {
  id:   string;
  name: string;
}

interface Cliente {
  id:          string;
  name:        string;
  email:       string;
  cnpj:        string;
  isActive:    boolean;
  escritorios: Escritorio[];
  createdAt:   string;
}

export default function AdminClientesPage() {
  const { token } = useAuth();

  const [clientes,   setClientes]   = useState<Cliente[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  const LIMIT = 20;

  const carregar = useCallback(async (p: number, s = search) => {
    if (!token) return;
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (s) params.set('search', s);

      const res = await fetch(`/api/v1/admin/clientes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { clientes: Cliente[]; total: number; page: number; totalPages: number };
      setClientes(data.clientes ?? []);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => { carregar(1); }, [carregar]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    carregar(1, search);
  };

  function fmtCnpj(cnpj: string) {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Todos os Clientes</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Clientes cadastrados em todos os escritórios da plataforma.
        </p>
      </div>

      {/* Busca */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou CNPJ…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-violet-500"
          />
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
          <h2 className="text-sm font-semibold text-slate-100">Clientes</h2>
          {!loading && <span className="text-xs text-slate-500">{total.toLocaleString('pt-BR')} registros</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Cliente</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">CNPJ</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-slate-400">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-400">Escritório(s)</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-400">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><Loader2 size={22} className="animate-spin text-violet-400 mx-auto" /></td></tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Users size={28} className="text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Nenhum cliente encontrado.</p>
                  </td>
                </tr>
              ) : (
                clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-slate-100 font-medium truncate max-w-[200px]">{c.name}</p>
                      <p className="text-xs text-slate-500 truncate">{c.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-400">{fmtCnpj(c.cnpj)}</td>
                    <td className="px-5 py-3.5 text-center">
                      {c.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-0.5 rounded-full">
                          <XCircle size={10} /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {c.escritorios.length === 0 ? (
                          <span className="text-xs text-slate-600">Sem escritório</span>
                        ) : (
                          c.escritorios.map((e) => (
                            <span key={e.id} className="text-[10px] text-violet-300 bg-violet-900/20 border border-violet-700/30 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                              {e.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
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
              className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => carregar(page + 1)} disabled={page >= totalPages || loading}
              className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
