'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  Users,
  FileText,
  ClipboardList,
  Upload,
  UserPlus,
  ArrowRight,
  AlertCircle,
  Inbox,
} from 'lucide-react';

import { KanbanBoard } from '../kanban/KanbanBoard';
import { RecentActivityFeed } from './RecentActivityFeed';
import { DashboardCharts } from './DashboardCharts';

// =============================================================================
// Tipos
// =============================================================================

interface DashboardStats {
  tarefasPendentes:         number;
  documentosNaoLidos:       number;
  clientesAtivos:           number;
  novosDocumentosRecebidos: number;
}

// =============================================================================
// Fetcher
// =============================================================================

async function statsFetcher([url, token]: [string, string]): Promise<DashboardStats> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return res.json() as Promise<DashboardStats>;
}

// =============================================================================
// MetricCard
// =============================================================================

interface MetricCardProps {
  label: string;
  valor: number | undefined;
  icone: React.ReactNode;
  cor:   string;
  carregando: boolean;
}

function MetricCard({ label, valor, icone, cor, carregando }: MetricCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cor}`}>
        {icone}
      </div>
      <div>
        {carregando ? (
          <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{valor ?? 0}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// =============================================================================
// QuickAction
// =============================================================================

interface QuickActionProps {
  label:   string;
  icone:   React.ReactNode;
  cor:     string;
  onClick: () => void;
}

function QuickAction({ label, icone, cor, onClick }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold text-white
        transition-all shadow-sm hover:shadow-md active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${cor}
      `}
    >
      {icone}
      {label}
      <ArrowRight size={14} className="ml-auto opacity-70" />
    </button>
  );
}

// =============================================================================
// DashboardContadorDono — Visão completa do escritório
// =============================================================================

export function DashboardContadorDono({ token }: { token: string | null }) {
  const router = useRouter();

  const swrKey: [string, string] | null = token
    ? ['/api/v1/dashboard/stats', token]
    : null;

  const { data: stats, error, isLoading } = useSWR(swrKey, statsFetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const handleKanbanErro = useCallback((_msg: string) => {}, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral do escritório em tempo real</p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Falha ao carregar métricas. Tente novamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Novos Documentos (24h)"
            valor={stats?.novosDocumentosRecebidos}
            icone={<Inbox size={22} className="text-emerald-600" />}
            cor="bg-emerald-50"
            carregando={isLoading}
          />
          <MetricCard
            label="Tarefas Pendentes"
            valor={stats?.tarefasPendentes}
            icone={<ClipboardList size={22} className="text-violet-600" />}
            cor="bg-violet-50"
            carregando={isLoading}
          />
          <MetricCard
            label="Documentos Não Lidos"
            valor={stats?.documentosNaoLidos}
            icone={<FileText size={22} className="text-amber-600" />}
            cor="bg-amber-50"
            carregando={isLoading}
          />
          <MetricCard
            label="Clientes Ativos"
            valor={stats?.clientesAtivos}
            icone={<Users size={22} className="text-primary" />}
            cor="bg-primary-50"
            carregando={isLoading}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <QuickAction
          label="Novo Upload em Lote"
          icone={<Upload size={18} />}
          cor="bg-primary hover:brightness-90 focus-visible:ring-primary"
          onClick={() => router.push('/lote')}
        />
        <QuickAction
          label="Adicionar Cliente"
          icone={<UserPlus size={18} />}
          cor="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
          onClick={() => router.push('/clientes')}
        />
      </div>

      <DashboardCharts token={token} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-900">Fluxo de Trabalho</h2>
          </div>
          <KanbanBoard token={token} onErro={handleKanbanErro} />
        </section>

        <section>
          <RecentActivityFeed token={token} />
        </section>
      </div>
    </div>
  );
}
