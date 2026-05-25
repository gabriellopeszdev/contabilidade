'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from 'react';
import { Search, X, Loader2, Building2 } from 'lucide-react';

interface ClienteOpcao {
  id:   string;
  nome: string;
  cnpj: string;
}

interface Props {
  getToken:  () => Promise<string>;
  value:     ClienteOpcao | null;
  onChange:  (cliente: ClienteOpcao | null) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 300;

export function FiltroClienteCombobox({
  getToken,
  value,
  onChange,
  placeholder = 'Filtrar cliente…',
}: Props) {
  const [query,       setQuery]       = useState('');
  const [resultados,  setResultados]  = useState<ClienteOpcao[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout>>();
  const abortRef     = useRef<AbortController>();

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buscar = useCallback(async (search: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const token = await getToken();
      const url = `/api/v1/clientes?limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResultados((data.clientes ?? []).map((c: any) => ({ id: c.id, nome: c.nome, cnpj: c.cnpj })));
      setActiveIndex(-1);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setResultados([]);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [getToken]);

  // Debounce ao digitar
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(query), DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, buscar]);

  const abrir = useCallback(() => {
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const selecionar = useCallback((c: ClienteOpcao) => {
    onChange(c);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const limpar = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  }, [onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, resultados.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && resultados[activeIndex]) selecionar(resultados[activeIndex]);
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  }, [activeIndex, resultados, selecionar]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger: cliente selecionado ou placeholder */}
      {!open ? (
        value ? (
          /* Chip com cliente selecionado */
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700
                          bg-blue-50 dark:bg-blue-900/20 text-xs font-medium text-blue-700 dark:text-blue-400 max-w-[200px]">
            <Building2 size={12} className="shrink-0" />
            <span className="truncate cursor-pointer flex-1" onClick={abrir}>{value.nome}</span>
            <button
              type="button"
              onClick={limpar}
              className="shrink-0 p-0.5 rounded hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              aria-label="Limpar filtro de cliente"
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          /* Botão de abertura */
          <button
            type="button"
            onClick={abrir}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                       bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400
                       hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
          >
            <Search size={12} />
            {placeholder}
          </button>
        )
      ) : (
        /* Input de busca */
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nome ou CNPJ…"
            className="w-48 pl-8 pr-7 py-1.5 text-xs rounded-lg border border-blue-400 dark:border-blue-600
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       placeholder:text-gray-400 dark:placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {loading && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 mt-1 w-64 max-h-60 overflow-y-auto rounded-xl border
                       border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl py-1">
          {loading && resultados.length === 0 ? (
            <li className="px-4 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
              <Loader2 size={14} className="inline-block animate-spin mr-1" /> Buscando…
            </li>
          ) : resultados.length === 0 ? (
            <li className="px-4 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
              {query ? 'Nenhum cliente encontrado.' : 'Digite para buscar…'}
            </li>
          ) : (
            resultados.map((c, i) => (
              <li
                key={c.id}
                onClick={() => selecionar(c)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors
                  ${activeIndex === i ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                  ${value?.id === c.id ? 'ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : ''}`}
              >
                <Building2 size={13} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{c.nome}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{c.cnpj}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
