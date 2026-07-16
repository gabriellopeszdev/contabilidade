'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { io } from 'socket.io-client';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Eye,
  Send,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  FileWarning,
} from 'lucide-react';

import {
  ClienteModal,
  type ClienteFormData,
} from '../../../src/presentation/components/cliente/ClienteModal';
import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { ClientesReadOnly } from '../../../src/presentation/components/cliente/ClientesReadOnly';

// =============================================================================
// Tipos
// =============================================================================

interface ClienteDTO {
  id:               string;
  nome:             string;
  email:            string;
  cnpj:             string;
  phone:            string | null;
  avatarUrl:        string | null;
  isActive:         boolean;
  assignedAt:       string;
  createdAt:        string;
  activatedAt:      string | null;
  cnae:             string | null;
  regimeTributario: string | null;
}

// =============================================================================
// SWR Fetcher
// =============================================================================

interface ClientesResponse {
  clientes:        ClienteDTO[];
  total:           number;
  totalPages:      number;
  hasNextPage:     boolean;
  hasPreviousPage: boolean;
}

const PER_PAGE = 20;

async function fetcher([url, token, page, search]: [string, string, number, string]): Promise<ClientesResponse> {
  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (search) params.set('search', search);
  const res = await fetch(`${url}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (res.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
  if (!res.ok) throw new Error(`Erro ao buscar clientes (HTTP ${res.status})`);

  return res.json() as Promise<ClientesResponse>;
}

// =============================================================================
// Helpers
// =============================================================================

function formatarCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

// =============================================================================
// Página: /(contador)/clientes
// =============================================================================

export default function ClientesPage() {
  const { token, isFuncionarioEscritorio } = useAuth();

  if (isFuncionarioEscritorio) {
    return <ClientesReadOnly />;
  }

  return <ClientesPageDono token={token} />;
}

function ClientesPageDono({ token }: { token: string | null }) {
  const router = useRouter();

  // Paginação e busca
  const [page,   setPage]   = useState(1);
  const [busca,  setBusca]  = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => { setPage(1); }, [buscaDebounced]);

  // SWR
  const swrKey: [string, string, number, string] | null = token
    ? ['/api/v1/clientes', token, page, buscaDebounced]
    : null;
  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    keepPreviousData:  true,
  });

  const clientes   = data?.clientes   ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Atualização em tempo real — escuta cliente_ativado via Socket.IO
  useEffect(() => {
    if (!token) return;
    const socket = io(process.env.NEXT_PUBLIC_APP_URL || window.location.origin, {
      path:             '/api/ws',
      addTrailingSlash: false,
      auth:             { token },
      transports:       ['websocket'],
      multiplex:        true,
    });
    socket.on('cliente_ativado', () => { void mutate(); });
    return () => { socket.off('cliente_ativado'); socket.disconnect(); };
  }, [token, mutate]);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<ClienteFormData | null>(null);

  const abrirCriar = useCallback(() => {
    setClienteEditando(null);
    setModalAberto(true);
  }, []);

  const abrirEditar = useCallback((c: ClienteDTO) => {
    setClienteEditando({
      id:               c.id,
      nome:             c.nome,
      email:            c.email,
      cnpj:             c.cnpj,
      phone:            c.phone ?? '',
      cnae:             c.cnae ?? '',
      regimeTributario: c.regimeTributario ?? '',
    });
    setModalAberto(true);
  }, []);

  const handleSucesso = useCallback(() => {
    mutate();
  }, [mutate]);

  // Exclusão com confirmação
  const [excluindo,         setExcluindo]         = useState<string | null>(null);
  const [reenviando,        setReenviando]         = useState<string | null>(null);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<ClienteDTO | null>(null);

  // Reenviar convite
  const handleReenviarConvite = useCallback(
    async (cliente: ClienteDTO) => {
      setReenviando(cliente.id);
      try {
        const res = await fetch(`/api/v1/clientes/${cliente.id}/reenviar-convite`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Erro HTTP ${res.status}`);
        }
        toast.success('Convite reenviado com sucesso!', { description: `E-mail enviado para ${cliente.email}` });
      } catch (err) {
        toast.error('Erro ao reenviar convite', { description: err instanceof Error ? err.message : 'Tente novamente.' });
      } finally {
        setReenviando(null);
      }
    },
    [token],
  );

  // Importar CSV
  const [modalImportAberto, setModalImportAberto] = useState(false);

  // Exportar CSV
  const handleExportarCSV = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/clientes/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clientes.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar CSV.');
    }
  }, [token]);

  const handleExcluir = useCallback((cliente: ClienteDTO) => {
    setClienteParaExcluir(cliente);
  }, []);

  const confirmarExclusao = useCallback(async () => {
    if (!clienteParaExcluir) return;
    const { id, nome } = clienteParaExcluir;
    setClienteParaExcluir(null);
    setExcluindo(id);
    try {
      const res = await fetch(`/api/v1/clientes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Erro HTTP ${res.status}`);
      }
      toast.success(`Cliente "${nome}" removido com sucesso.`);
      mutate();
    } catch (err) {
      toast.error('Erro ao remover cliente', { description: err instanceof Error ? err.message : 'Tente novamente.' });
    } finally {
      setExcluindo(null);
    }
  }, [clienteParaExcluir, token, mutate]);

  // Ref e foco acessível do modal de exclusão
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (clienteParaExcluir && modalRef.current) {
      modalRef.current.focus();
    }
  }, [clienteParaExcluir]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gestão de Clientes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {total} cliente{total !== 1 ? 's' : ''} na carteira
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportarCSV}
            aria-label="Exportar CSV"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300
              bg-white dark:bg-gray-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setModalImportAberto(true)}
            aria-label="Importar CSV"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300
              bg-white dark:bg-gray-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-all shadow-sm
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">Importar CSV</span>
          </button>
          <button
            type="button"
            onClick={abrirCriar}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary
              rounded-lg hover:brightness-90 transition-all shadow-sm
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Novo Cliente</span>
          </button>
        </div>
      </div>

        {/* Barra de busca */}
        <div className="mb-5">
          <div className="relative max-w-md">
            <label htmlFor="busca-clientes" className="sr-only">Buscar clientes</label>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="busca-clientes"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CNPJ ou e-mail…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-800
                text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        {/* Estados */}
        {error ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Falha ao carregar clientes</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{error.message}</p>
            <button
              type="button"
              onClick={() => mutate()}
              className="mt-2 px-4 py-2 text-sm font-semibold text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        ) : isLoading ? (
          <div role="status" className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando clientes…</p>
            <span className="sr-only">Carregando...</span>
          </div>
        ) : clientes.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 dark:bg-gray-800">
              <Users size={24} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {buscaDebounced ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              {buscaDebounced
                ? 'Tente uma busca diferente.'
                : 'Cadastre o primeiro cliente da sua carteira.'}
            </p>
            {!buscaDebounced && (
              <button
                type="button"
                onClick={abrirCriar}
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:brightness-90 transition-all"
              >
                <Plus size={15} />
                Novo Cliente
              </button>
            )}
          </div>
        ) : (
          /* Tabela semântica */
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-slate-50 dark:bg-gray-800 border-b border-slate-100 dark:border-gray-700">
                  <tr>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cliente</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[180px]">CNPJ</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[200px]">E-mail</th>
                    <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[120px]">Desde</th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[130px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  {clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                      {/* Avatar + Nome */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-9 h-9 rounded-full bg-primary-light text-primary-dark
                            flex items-center justify-center text-xs font-bold">
                            {iniciais(c.nome)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => router.push(`/clientes/${c.id}`)}
                                className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate hover:text-primary transition-colors text-left"
                              >
                                {c.nome}
                              </button>
                              {c.activatedAt === null ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px]
                                  font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                  Pendente
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px]
                                  font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  Ativo
                                </span>
                              )}
                            </div>
                            {c.phone && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                <Phone size={10} /> {c.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* CNPJ */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-mono">{formatarCNPJ(c.cnpj)}</span>
                        </div>
                      </td>
                      {/* E-mail */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{c.email}</span>
                        </div>
                      </td>
                      {/* Desde */}
                      <td className="px-5 py-4">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{formatarData(c.createdAt)}</span>
                      </td>
                      {/* Ações */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {c.activatedAt === null && (
                            <button
                              type="button"
                              onClick={() => handleReenviarConvite(c)}
                              disabled={reenviando === c.id}
                              aria-label={`Reenviar convite para ${c.nome}`}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                            >
                              {reenviando === c.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => router.push(`/clientes/${c.id}`)}
                            aria-label={`Ver prontuário de ${c.nome}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEditar(c)}
                            aria-label={`Editar ${c.nome}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluir(c)}
                            disabled={excluindo === c.id}
                            aria-label={`Remover ${c.nome}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            {excluindo === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé com paginação */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 flex items-center justify-between gap-4 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {clientes.length} de {total} cliente{total !== 1 ? 's' : ''}
                {buscaDebounced ? ' (filtrado)' : ''}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isLoading}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-slate-600 dark:text-slate-400 min-w-[80px] text-center">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      {/* Modal de Criar/Editar */}
      <ClienteModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        dadosIniciais={clienteEditando}
        token={token ?? ''}
        onSucesso={handleSucesso}
      />

      {/* Modal de Importação CSV */}
      {modalImportAberto && (
        <ModalImportarCSV
          token={token ?? ''}
          onFechar={() => setModalImportAberto(false)}
          onImportou={() => { void mutate(); }}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {clienteParaExcluir && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-excluir-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setClienteParaExcluir(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setClienteParaExcluir(null); }}
          tabIndex={-1}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 id="modal-excluir-titulo" className="text-base font-bold text-gray-900 dark:text-gray-100">Remover cliente</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Esta ação não pode ser desfeita.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClienteParaExcluir(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Corpo */}
            <div className="bg-slate-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-5 border border-slate-200 dark:border-gray-700">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Você está prestes a remover o cliente{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {clienteParaExcluir.nome}
                </span>
                . O acesso ao sistema será revogado imediatamente.
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setClienteParaExcluir(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-gray-800
                  border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusao}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700
                  rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                Remover cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ModalImportarCSV — Importação em massa via CSV
// =============================================================================

interface ImportarCSVResultado {
  totalLinhas: number;
  sucesso:     number;
  falhas:      number;
  erros:       Array<{ linha: number; motivo: string }>;
}

interface ModalImportarCSVProps {
  token:       string;
  onFechar:    () => void;
  onImportou:  () => void;
}

function ModalImportarCSV({ token, onFechar, onImportou }: ModalImportarCSVProps) {
  const [arquivo,       setArquivo]       = useState<File | null>(null);
  const [importando,    setImportando]    = useState(false);
  const [resultado,     setResultado]     = useState<ImportarCSVResultado | null>(null);
  const [erroGlobal,    setErroGlobal]    = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleArquivo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setArquivo(f);
    setResultado(null);
    setErroGlobal(null);
  }, []);

  const handleBaixarTemplate = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/clientes/importar/template', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-importacao-clientes.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao baixar template.');
    }
  }, [token]);

  const handleImportar = useCallback(async () => {
    if (!arquivo) return;
    setImportando(true);
    setErroGlobal(null);
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append('file', arquivo);

      const res = await fetch('/api/v1/clientes/importar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const body = await res.json() as { message?: string } & Partial<ImportarCSVResultado>;

      if (!res.ok) {
        setErroGlobal(body.message ?? `Erro HTTP ${res.status}`);
        return;
      }

      const r: ImportarCSVResultado = {
        totalLinhas: body.totalLinhas ?? 0,
        sucesso:     body.sucesso     ?? 0,
        falhas:      body.falhas      ?? 0,
        erros:       body.erros       ?? [],
      };
      setResultado(r);

      if (r.sucesso > 0) {
        onImportou();
        toast.success(
          `${r.sucesso} cliente${r.sucesso !== 1 ? 's' : ''} importado${r.sucesso !== 1 ? 's' : ''} com sucesso!`,
          r.falhas > 0 ? { description: `${r.falhas} linha${r.falhas !== 1 ? 's' : ''} com erro.` } : undefined,
        );
      } else {
        toast.error('Nenhum cliente foi importado.', {
          description: r.falhas > 0 ? `${r.falhas} linha${r.falhas !== 1 ? 's' : ''} com erro.` : undefined,
        });
      }
    } catch (err) {
      setErroGlobal(err instanceof Error ? err.message : 'Erro desconhecido.');
    } finally {
      setImportando(false);
    }
  }, [arquivo, token, onImportou]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-import-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onFechar}
      onKeyDown={(e) => { if (e.key === 'Escape') onFechar(); }}
      tabIndex={-1}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
              <Upload size={18} className="text-primary" />
            </div>
            <div>
              <h2 id="modal-import-titulo" className="text-base font-bold text-gray-900 dark:text-gray-100">
                Importar Clientes via CSV
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Importe múltiplos clientes de uma vez
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Link para baixar template */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Use o modelo oficial para garantir que as colunas estejam no formato correto.
          </p>
          <button
            type="button"
            onClick={handleBaixarTemplate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Download size={13} />
            Baixar modelo CSV
          </button>
        </div>

        {/* Área de seleção de arquivo */}
        {!resultado && (
          <div className="mb-4">
            <label
              htmlFor="csv-file-input"
              className="flex flex-col items-center justify-center gap-2 w-full cursor-pointer
                border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6
                hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/5 transition-colors"
            >
              {arquivo ? (
                <>
                  <CheckCircle2 size={24} className="text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center break-all">
                    {arquivo.name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {(arquivo.size / 1024).toFixed(1)} KB — clique para trocar
                  </span>
                </>
              ) : (
                <>
                  <FileWarning size={24} className="text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Selecione um arquivo CSV
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Clique aqui ou arraste o arquivo
                  </span>
                </>
              )}
            </label>
            <input
              ref={inputRef}
              id="csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleArquivo}
            />
          </div>
        )}

        {/* Erro global */}
        {erroGlobal && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs">{erroGlobal}</p>
          </div>
        )}

        {/* Resultado da importação */}
        {resultado && (
          <div className="mb-4 space-y-3">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-3 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
                <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{resultado.totalLinhas}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center">Total de linhas</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{resultado.sucesso}</span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-500 text-center">Importados</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <span className="text-lg font-bold text-red-600 dark:text-red-400">{resultado.falhas}</span>
                <span className="text-[11px] text-red-500 dark:text-red-400 text-center">Com erro</span>
              </div>
            </div>

            {/* Detalhes de erros */}
            {resultado.erros.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-gray-700 divide-y divide-slate-100 dark:divide-gray-700">
                {resultado.erros.map((e) => (
                  <div key={e.linha} className="px-3 py-2 flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                      Linha {e.linha}
                    </span>
                    <span className="text-xs text-red-600 dark:text-red-400">{e.motivo}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Importar outro arquivo */}
            <button
              type="button"
              onClick={() => {
                setResultado(null);
                setArquivo(null);
                setErroGlobal(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="w-full text-xs font-semibold text-primary hover:underline py-1"
            >
              Importar outro arquivo
            </button>
          </div>
        )}

        {/* Botões de ação */}
        {!resultado && (
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-gray-800
                border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImportar}
              disabled={!arquivo || importando}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary
                rounded-lg hover:brightness-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {importando ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Importando…
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Importar
                </>
              )}
            </button>
          </div>
        )}

        {resultado && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:brightness-90 transition-all"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
