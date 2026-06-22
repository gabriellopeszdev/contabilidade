'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Loader2, AlertCircle, Search,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  Pencil, X,
} from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';
import type { ProviderAssinatura } from '@prisma/client';

interface Escritorio {
  id:   string;
  name: string;
}

interface Cliente {
  id:                 string;
  name:               string;
  email:              string;
  cnpj:               string;
  isActive:           boolean;
  providerAssinatura: 'INTERNO' | 'DOCSEAL' | 'SIGNATUREAPI';
  escritorios:        Escritorio[];
  createdAt:          string;
}

interface ModalEditarClienteProps {
  cliente: Cliente;
  onClose: () => void;
  onSalvo: (atualizado: Partial<Cliente>) => void;
  token:   string;
}

function ModalEditarCliente({ cliente, onClose, onSalvo, token }: ModalEditarClienteProps) {
  const [form, setForm] = useState({
    name:               cliente.name,
    email:              cliente.email,
    cnpj:               cliente.cnpj,
    isActive:           cliente.isActive,
    providerAssinatura: cliente.providerAssinatura ?? 'INTERNO',
  });
  const [erros,    setErros]    = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro,     setErro]     = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (modalRef.current) modalRef.current.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setForm((f) => ({ ...f, [name]: val }));
    setErros((prev) => { const n = { ...prev }; delete n[name]; return n; });
    setErro('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const res = await fetch(`/api/v1/admin/clientes/${cliente.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(form),
      });
      const data = await res.json() as { ok?: boolean; message?: string; fields?: Record<string, string> };
      if (!res.ok) {
        if (data.fields) setErros(data.fields);
        setErro(data.message ?? `Erro HTTP ${res.status}`);
        return;
      }
      onSalvo({
        name:               form.name,
        email:              form.email,
        cnpj:               form.cnpj.replace(/\D/g, ''),
        isActive:           form.isActive,
        providerAssinatura: form.providerAssinatura as ProviderAssinatura,
      });
      onClose();
    } catch {
      setErro('Erro de rede. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const field = (name: keyof typeof form, label: string, type = 'text', placeholder = '', inputId = '') => (
    <div>
      <label htmlFor={inputId || name} className="block text-[11px] font-medium text-slate-400 mb-1">{label}</label>
      <input
        id={inputId || name}
        name={name}
        type={type}
        value={form[name] as string}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 ${erros[name] ? 'border-red-500' : 'border-slate-700'}`}
      />
      {erros[name] && <p className="text-xs text-red-400 mt-1">{erros[name]}</p>}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-editar-cliente-titulo"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl focus:outline-none"
      >

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 id="modal-editar-cliente-titulo" className="text-sm font-bold text-white">Editar Cliente</h2>
            <p className="text-xs text-slate-400 mt-0.5">{cliente.name}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
          {erro && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2.5">
              <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{erro}</p>
            </div>
          )}

          {field('name',  'Nome do cliente *', 'text',  'Empresa Fictícia Ltda', 'cliente-nome')}
          {field('email', 'E-mail *',          'email', 'contato@empresa.com',   'cliente-email')}
          {field('cnpj',  'CNPJ *',            'text',  '14 dígitos',            'cliente-cnpj')}

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Provedor de Assinatura *</label>
            <select
              name="providerAssinatura"
              value={form.providerAssinatura}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            >
              <option value="INTERNO">Interno (FiscoHub)</option>
              <option value="DOCSEAL">DocSeal</option>
              <option value="SIGNATUREAPI">SignatureAPI</option>
            </select>
          </div>

          <div className="flex items-center gap-3 py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
                className="rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-violet-500 w-4 h-4"
              />
              <span className="text-xs font-medium text-slate-300">Cliente Ativo</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={enviando}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg transition-colors">
              {enviando && <Loader2 size={13} className="animate-spin" />}
              {enviando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminClientesPage() {
  const { token } = useAuth();

  const [clientes,    setClientes]    = useState<Cliente[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [erro,        setErro]        = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [modalEditar, setModalEditar] = useState<Cliente | null>(null);

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
      {modalEditar && (
        <ModalEditarCliente
          cliente={modalEditar}
          token={token ?? ''}
          onClose={() => setModalEditar(null)}
          onSalvo={(atualizado) => {
            setClientes((prev) =>
              prev.map((c) => c.id === modalEditar.id ? { ...c, ...atualizado } : c)
            );
          }}
        />
      )}

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
            aria-label="Buscar clientes"
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
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-400">Cliente</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-400">CNPJ</th>
                <th scope="col" className="px-5 py-3 text-center text-xs font-medium text-slate-400">Status</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-slate-400">Escritório(s)</th>
                <th scope="col" className="px-5 py-3 text-center text-xs font-medium text-slate-400">Assinatura</th>
                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-slate-400">Desde</th>
                <th scope="col" className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center"><Loader2 size={22} className="animate-spin text-violet-400 mx-auto" /></td></tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
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
                    <td className="px-5 py-3.5 text-center">
                      {c.providerAssinatura === 'SIGNATUREAPI' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-900/30 border-emerald-700/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          SignatureAPI
                        </span>
                      ) : c.providerAssinatura === 'DOCSEAL' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-primary bg-primary/20 border-primary/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          DocSeal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border text-slate-400 bg-slate-800 border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          Interno
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setModalEditar(c)}
                        title="Editar cliente"
                        aria-label="Editar cliente"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                      >
                        <Pencil size={12} />
                        Editar
                      </button>
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
