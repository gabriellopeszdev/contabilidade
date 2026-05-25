'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  type KeyboardEvent,
} from 'react';
import { Search, Building2, ChevronDown, X, Loader2 } from 'lucide-react';

// =============================================================================
// Tipos
// =============================================================================

export interface ClienteResumo {
  id:    string;
  nome:  string;
  cnpj:  string;
  email: string;
}

export interface ClienteComboboxProps {
  /** JWT getter para autenticar a requisição. */
  getToken: () => Promise<string>;
  /** Callback ao selecionar um cliente. null se desselecionar. */
  onSelect: (cliente: ClienteResumo | null) => void;
  /** Cliente atualmente selecionado (controlado externamente). */
  value: ClienteResumo | null;
  /** Desabilita interação (ex: durante envio). */
  disabled?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

/** Formata CNPJ: 12345678000199 → 12.345.678/0001-99 */
function formatarCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

const DEBOUNCE_MS = 300;

// =============================================================================
// Componente: ClienteCombobox
// =============================================================================

export function ClienteCombobox({
  getToken,
  onSelect,
  value,
  disabled = false,
}: ClienteComboboxProps) {
  const [query, setQuery]         = useState('');
  const [clientes, setClientes]   = useState<ClienteResumo[]>([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const listboxRef   = useRef<HTMLUListElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout>>();
  const abortRef     = useRef<AbortController>();

  const uid          = useId();
  const listboxId    = uid + '-listbox';

  // ---------------------------------------------------------------------------
  // Fetch clientes com debounce
  // ---------------------------------------------------------------------------
  const fetchClientes = useCallback(
    async (search: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const token = await getToken();
        const url = `/api/v1/clientes${search ? `?search=${encodeURIComponent(search)}` : ''}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error('Erro ao buscar clientes');

        const data = await res.json();
        const lista: ClienteResumo[] = (data.clientes ?? []).map(
          (c: { id: string; nome: string; cnpj: string; email: string }) => ({
            id:    c.id,
            nome:  c.nome,
            cnpj:  c.cnpj,
            email: c.email,
          }),
        );
        setClientes(lista);
        setActiveIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setClientes([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [getToken],
  );

  // ---------------------------------------------------------------------------
  // Debounce do input
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchClientes(query), DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, fetchClientes]);

  // ---------------------------------------------------------------------------
  // Fechar ao clicar fora
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---------------------------------------------------------------------------
  // Scroll into view do item ativo
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (activeIndex < 0 || !listboxRef.current) return;
    const item = listboxRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled]);

  const handleSelect = useCallback(
    (cliente: ClienteResumo) => {
      onSelect(cliente);
      setOpen(false);
      setQuery('');
    },
    [onSelect],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(null);
      setQuery('');
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, clientes.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && clientes[activeIndex]) {
            handleSelect(clientes[activeIndex]);
          }
          break;
        case 'Escape':
          setOpen(false);
          break;
      }
    },
    [open, activeIndex, clientes, handleSelect],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div ref={containerRef} className="relative">
      {/* Label */}
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
        <Building2 size={14} className="inline-block mr-1.5 -mt-0.5 text-gray-500 dark:text-gray-400" />
        Cliente (Empresa)
      </label>

      {/* Trigger / Display */}
      {!open ? (
        <div
          className={`w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left
                      transition-all
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                      ${value
                        ? 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/20'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
        >
          {value ? (
            <>
              <button
                type="button"
                onClick={handleOpen}
                disabled={disabled}
                className="flex items-center gap-3 flex-1 min-w-0 focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-violet-400 rounded-lg"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 shrink-0">
                  <Building2 size={16} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{value.nome}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatarCNPJ(value.cnpj)}</p>
                </div>
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Remover cliente selecionado"
                  className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                             transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleOpen}
              disabled={disabled}
              className="flex items-center gap-3 flex-1 min-w-0 focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-violet-400 rounded-lg"
            >
              <Search size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <span className="text-sm text-gray-400 dark:text-gray-500 flex-1 text-left">
                Buscar por nome ou CNPJ…
              </span>
              <ChevronDown size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
            </button>
          )}
        </div>
      ) : (
        /* Search Input (quando aberto) */
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${uid}-option-${activeIndex}` : undefined}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite o nome ou CNPJ…"
            className="w-full rounded-xl border border-violet-400 dark:border-violet-600 bg-white dark:bg-gray-800 pl-10 pr-10 py-2.5
                       text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 dark:focus:ring-offset-gray-900"
          />
          {loading && (
            <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2
                                          text-violet-500 animate-spin" />
          )}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <ul
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl border
                     border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1"
        >
          {loading && clientes.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              <Loader2 size={18} className="inline-block animate-spin mr-2" />
              Buscando clientes…
            </li>
          ) : clientes.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              {query ? 'Nenhum cliente encontrado.' : 'Digite para buscar…'}
            </li>
          ) : (
            clientes.map((cliente, index) => (
              <li
                key={cliente.id}
                id={`${uid}-option-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelect(cliente)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                            ${activeIndex === index
                              ? 'bg-violet-50 dark:bg-violet-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }
                            ${value?.id === cliente.id ? 'ring-2 ring-inset ring-violet-300 dark:ring-violet-700' : ''}`}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0">
                  <Building2 size={16} className="text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{cliente.nome}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatarCNPJ(cliente.cnpj)}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
