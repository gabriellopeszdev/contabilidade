'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, FileText, Users, CalendarCheck, Loader2, X } from 'lucide-react';
import Link from 'next/link';

interface DocResult     { id: string; fileName: string; fileType: string; sector: string; cliente: string; createdAt: string }
interface ClienteResult { id: string; name: string; email: string; cnpj: string; isActive: boolean }
interface ObrigResult   { id: string; nome: string; descricao: string; tipo: string }

interface SearchResults {
  documentos:  DocResult[];
  clientes:    ClienteResult[];
  obrigacoes:  ObrigResult[];
}

export default function BuscaPage() {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback(async (texto: string) => {
    if (texto.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/busca?q=${encodeURIComponent(texto)}`);
      if (!res.ok) throw new Error();
      setResults(await res.json() as SearchResults);
    } catch {
      setError('Erro ao buscar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(valor: string) {
    setQ(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(valor), 400);
  }

  const total = results
    ? results.documentos.length + results.clientes.length + results.obrigacoes.length
    : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Busca Global</h1>
        <p className="text-sm text-gray-500 mt-1">Pesquise documentos, clientes e obrigações fiscais</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Digite para pesquisar… (mín. 2 caracteres)"
          className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {q && (
          <button
            onClick={() => { setQ(''); setResults(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Buscando…
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Empty state */}
      {results && total === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum resultado encontrado para <strong>&quot;{q}&quot;</strong></p>
        </div>
      )}

      {/* Results */}
      {results && total > 0 && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">
            {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>

          {/* Documentos */}
          {results.documentos.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                <FileText size={13} /> Documentos ({results.documentos.length})
              </h2>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                {results.documentos.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.fileName}</p>
                      <p className="text-xs text-gray-500">{d.cliente} · {d.sector} · {d.createdAt}</p>
                    </div>
                    <span className="ml-4 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono shrink-0">
                      {d.fileType}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Clientes */}
          {results.clientes.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                <Users size={13} /> Clientes ({results.clientes.length})
              </h2>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                {results.clientes.map((c) => (
                  <Link
                    key={c.id}
                    href={`/clientes/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.cnpj} · {c.email}</p>
                    </div>
                    <span className={`ml-4 text-xs px-2 py-0.5 rounded shrink-0 ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Obrigações */}
          {results.obrigacoes.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest">
                <CalendarCheck size={13} /> Obrigações Fiscais ({results.obrigacoes.length})
              </h2>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                {results.obrigacoes.map((o) => (
                  <Link
                    key={o.id}
                    href="/calendario"
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{o.nome}</p>
                      <p className="text-xs text-gray-500">{o.descricao || o.tipo}</p>
                    </div>
                    <span className="ml-4 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded shrink-0">
                      {o.tipo}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
