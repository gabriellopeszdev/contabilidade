'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Search, FileText, Users, CalendarCheck, Loader2, X, Download, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

interface DocResult     { id: string; fileName: string; fileType: string; sector: string; cliente: string; createdAt: string }
interface ClienteResult { id: string; name: string; email: string; cnpj: string; isActive: boolean }
interface ObrigResult   { id: string; nome: string; descricao: string; tipo: string }

interface SearchResults {
  documentos:  DocResult[];
  clientes:    ClienteResult[];
  obrigacoes:  ObrigResult[];
}

export default function BuscaPage() {
  const { getToken } = useAuth();
  const [q, setQ]                   = useState('');
  const [results, setResults]       = useState<SearchResults | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroTipo, setFiltroTipo]   = useState('');

  async function handleDownloadDoc(id: string) {
    setDownloadingId(id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/v1/documentos/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        toast.error(data.message ?? 'Não foi possível baixar o documento.');
        return;
      }
      const { url } = await res.json() as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Erro de conexão ao baixar o documento.');
    } finally {
      setDownloadingId(null);
    }
  }
  const debounceRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback(async (texto: string, setor?: string, tipo?: string) => {
    if (texto.trim().length < 2) { setResults(null); return; }
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      let url = `/api/v1/busca?q=${encodeURIComponent(texto)}`;
      if (setor) url += `&setor=${encodeURIComponent(setor)}`;
      if (tipo)  url += `&tipo=${encodeURIComponent(tipo)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setResults(await res.json() as SearchResults);
    } catch {
      setError('Erro ao buscar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  function handleChange(valor: string) {
    setQ(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(valor, filtroSetor, filtroTipo), 400);
  }

  function handleFiltroSetor(value: string) {
    setFiltroSetor(value);
    if (q.length >= 2) buscar(q, value, filtroTipo);
  }

  function handleFiltroTipo(value: string) {
    setFiltroTipo(value);
    if (q.length >= 2) buscar(q, filtroSetor, value);
  }

  const total = results
    ? results.documentos.length + results.clientes.length + results.obrigacoes.length
    : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Busca Global</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pesquise documentos, clientes e obrigações fiscais</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Digite para pesquisar… (mín. 2 caracteres)"
          className="w-full pl-11 pr-10 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        {q && (
          <button
            onClick={() => { setQ(''); setResults(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filters — visible only when query has 2+ chars */}
      {q.length >= 2 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <SlidersHorizontal size={14} className="text-gray-400" />

          {/* Setor filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Setor:</span>
            {(['', 'FISCAL', 'PESSOAL', 'CONTABIL'] as const).map((value) => {
              const label = value === '' ? 'Todos' : value.charAt(0) + value.slice(1).toLowerCase();
              const isActive = filtroSetor === value;
              return (
                <button
                  key={value}
                  onClick={() => handleFiltroSetor(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {label === 'Contabil' ? 'Contábil' : label}
                </button>
              );
            })}
          </div>

          {/* Tipo filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Tipo:</span>
            {(['', 'PDF', 'XML', 'XLSX', 'DOCX', 'CSV', 'OFX', 'ODS'] as const).map((value) => {
              const label = value === '' ? 'Todos' : value;
              const isActive = filtroTipo === value;
              return (
                <button
                  key={value}
                  onClick={() => handleFiltroTipo(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Buscando…
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Empty state */}
      {results && total === 0 && !loading && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum resultado encontrado para <strong>&quot;{q}&quot;</strong></p>
        </div>
      )}

      {/* Results */}
      {results && total > 0 && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>

          {/* Documentos */}
          {results.documentos.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                <FileText size={13} /> Documentos ({results.documentos.length})
              </h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                {results.documentos.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleDownloadDoc(d.id)}
                    disabled={downloadingId === d.id}
                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{d.fileName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{d.cliente} · {d.sector} · {d.createdAt}</p>
                    </div>
                    <div className="ml-4 flex items-center gap-2 shrink-0">
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded font-mono">
                        {d.fileType}
                      </span>
                      {downloadingId === d.id
                        ? <Loader2 size={13} className="animate-spin text-primary" />
                        : <Download size={13} className="text-gray-400" />
                      }
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Clientes */}
          {results.clientes.length > 0 && (
            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                <Users size={13} /> Clientes ({results.clientes.length})
              </h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                {results.clientes.map((c) => (
                  <Link
                    key={c.id}
                    href={`/clientes/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.cnpj} · {c.email}</p>
                    </div>
                    <span className={`ml-4 text-xs px-2 py-0.5 rounded shrink-0 ${
                      c.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
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
              <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                <CalendarCheck size={13} /> Obrigações Fiscais ({results.obrigacoes.length})
              </h2>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                {results.obrigacoes.map((o) => (
                  <Link
                    key={o.id}
                    href="/calendario"
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{o.nome}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{o.descricao || o.tipo}</p>
                    </div>
                    <span className="ml-4 text-xs bg-primary-50 dark:bg-primary/10 text-primary-dark dark:text-primary px-2 py-0.5 rounded shrink-0">
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
