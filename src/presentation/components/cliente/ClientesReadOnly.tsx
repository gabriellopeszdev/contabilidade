'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Users,
  Search,
  Loader2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Eye,
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface ClienteDTO {
  id:         string;
  nome:       string;
  email:      string;
  cnpj:       string;
  phone:      string | null;
  avatarUrl:  string | null;
  isActive:   boolean;
  assignedAt: string;
  createdAt:  string;
}

// =============================================================================
// SWR Fetcher
// =============================================================================

async function fetcher([url, token]: [string, string]): Promise<{ clientes: ClienteDTO[] }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
  if (!res.ok) throw new Error(`Erro ao buscar clientes (HTTP ${res.status})`);
  return res.json() as Promise<{ clientes: ClienteDTO[] }>;
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
// ClientesReadOnly — Visão somente leitura para funcionários do escritório
//
// Lista os clientes da carteira do contador (superior). O funcionário pode
// ver os dados e acessar o detalhe (prontuário) de cada cliente, mas não
// pode criar, editar ou excluir.
// =============================================================================

export function ClientesReadOnly() {
  const { token, usuario } = useAuth();
  const router = useRouter();

  const swrKey: [string, string] | null = token ? ['/api/v1/clientes', token] : null;
  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const clientes = data?.clientes ?? [];

  // Busca local
  const [busca, setBusca] = useState('');
  const filtrados = busca.trim()
    ? clientes.filter(
        (c) =>
          c.nome.toLowerCase().includes(busca.toLowerCase()) ||
          c.cnpj.includes(busca.replace(/\D/g, '')) ||
          c.email.toLowerCase().includes(busca.toLowerCase()),
      )
    : clientes;

  const setoresLabel = usuario?.setores?.length
    ? usuario.setores.join(', ')
    : 'seus setores';

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Clientes do Escritório</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} na carteira
        </p>
      </div>

      {/* Banner informativo */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3 mb-5">
        <ShieldCheck size={18} className="text-blue-500 shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Modo visualização — você pode consultar clientes e documentos de {setoresLabel}.
        </p>
      </div>

      {/* Barra de busca */}
      <div className="mb-5">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou e-mail…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800
              text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Estados */}
      {error ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">Falha ao carregar clientes</p>
          <p className="text-xs text-slate-500 dark:text-gray-400">{error.message}</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Carregando clientes…</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 dark:bg-gray-800">
            <Users size={24} className="text-slate-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
            {busca.trim() ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400 max-w-xs">
            {busca.trim() ? 'Tente uma busca diferente.' : 'Não há clientes na carteira.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Header da tabela */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_180px_200px_120px_80px] gap-4 px-5 py-3
            border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
            <span>Cliente</span>
            <span>CNPJ</span>
            <span>E-mail</span>
            <span>Desde</span>
            <span className="text-right">Ações</span>
          </div>

          {/* Linhas */}
          <ul role="list" className="divide-y divide-slate-100 dark:divide-gray-700">
            {filtrados.map((c) => (
              <li key={c.id} className="group">
                <div className="sm:grid sm:grid-cols-[1fr_180px_200px_120px_80px] gap-4 items-center
                  px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">

                  {/* Avatar + Nome + Telefone */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400
                      flex items-center justify-center text-xs font-bold">
                      {iniciais(c.nome)}
                    </div>
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => router.push(`/clientes/${c.id}`)}
                        className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate hover:text-blue-600 dark:hover:text-blue-400
                          transition-colors text-left"
                      >
                        {c.nome}
                      </button>
                      {c.phone && (
                        <p className="text-xs text-slate-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                          <Phone size={10} /> {c.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* CNPJ */}
                  <div className="flex items-center gap-1.5 mt-2 sm:mt-0">
                    <Building2 size={12} className="text-slate-400 shrink-0 hidden sm:block" />
                    <span className="text-xs text-slate-700 dark:text-gray-300 font-mono">
                      {formatarCNPJ(c.cnpj)}
                    </span>
                  </div>

                  {/* E-mail */}
                  <div className="flex items-center gap-1.5 mt-1 sm:mt-0 min-w-0">
                    <Mail size={12} className="text-slate-400 shrink-0 hidden sm:block" />
                    <span className="text-sm text-slate-600 dark:text-gray-400 truncate">{c.email}</span>
                  </div>

                  {/* Desde */}
                  <span className="text-xs text-slate-500 dark:text-gray-400 mt-1 sm:mt-0">
                    {formatarData(c.createdAt)}
                  </span>

                  {/* Ação: apenas visualizar */}
                  <div className="flex items-center justify-end mt-2 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => router.push(`/clientes/${c.id}`)}
                      aria-label={`Ver prontuário de ${c.nome}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20
                        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Rodapé */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800">
            <span className="text-xs text-slate-500 dark:text-gray-400">
              {filtrados.length} de {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
              {busca.trim() ? ' (filtrado)' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
