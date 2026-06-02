'use client';

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
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cor}`}>
        {icone}
      </div>
      <div>
        {carregando ? (
          <div className="h-7 w-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{valor ?? 0}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Visão geral do escritório em tempo real</p>
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
            <ClipboardList size={16} className="text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Fluxo de Trabalho</h2>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
              <ClipboardList size={26} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {isLoading ? '…' : (stats?.tarefasPendentes ?? 0)} tarefas em andamento
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                Acesse o Kanban para visualizar e gerenciar o fluxo de trabalho da equipe
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/kanban')}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              Abrir Kanban
              <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section>
          <RecentActivityFeed token={token} />
        </section>
      </div>
    </div>
  );
}
