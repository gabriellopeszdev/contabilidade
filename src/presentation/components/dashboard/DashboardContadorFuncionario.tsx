'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import {
  FileText,
  ClipboardList,
  AlertCircle,
  Inbox,
  ShieldCheck,
} from 'lucide-react';

import { KanbanBoard } from '../kanban/KanbanBoard';
import { RecentActivityFeed } from './RecentActivityFeed';
import { BannerIbsCbs } from './BannerIbsCbs';

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
// DashboardContadorFuncionario — Visão restrita do funcionário do escritório
//
// Mostra métricas relevantes ao trabalho do funcionário (tarefas e documentos),
// kanban filtrado por seus setores e feed de atividade. Sem dados financeiros,
// gerenciamento de clientes ou uploads em lote.
// =============================================================================

interface Props {
  token: string | null;
  setores?: string[];
}

export function DashboardContadorFuncionario({ token, setores }: Props) {
  const swrKey: [string, string] | null = token
    ? ['/api/v1/dashboard/stats', token]
    : null;

  const { data: stats, error, isLoading } = useSWR(swrKey, statsFetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const handleKanbanErro = useCallback((_msg: string) => {}, []);

  const setoresLabel = setores?.length
    ? setores.join(', ')
    : 'seus setores';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Meu Painel</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Suas tarefas e documentos — {setoresLabel}
        </p>
      </div>

      <BannerIbsCbs token={token} />

      {/* Banner informativo */}
      <div className="bg-primary/10 dark:bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
        <ShieldCheck size={18} className="text-primary shrink-0" />
        <p className="text-sm text-primary dark:text-primary">
          Você está visualizando dados dos setores que possui acesso.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Falha ao carregar métricas. Tente novamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Novos Documentos (24h)"
            valor={stats?.novosDocumentosRecebidos}
            icone={<Inbox size={22} className="text-emerald-600 dark:text-emerald-400" />}
            cor="bg-emerald-50 dark:bg-emerald-950/20"
            carregando={isLoading}
          />
          <MetricCard
            label="Tarefas Pendentes"
            valor={stats?.tarefasPendentes}
            icone={<ClipboardList size={22} className="text-violet-600 dark:text-violet-400" />}
            cor="bg-violet-50 dark:bg-violet-950/20"
            carregando={isLoading}
          />
          <MetricCard
            label="Documentos Não Lidos"
            valor={stats?.documentosNaoLidos}
            icone={<FileText size={22} className="text-amber-600 dark:text-amber-400" />}
            cor="bg-amber-50 dark:bg-amber-950/20"
            carregando={isLoading}
          />
        </div>
      )}

      {/* Kanban + Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Fluxo de Trabalho</h2>
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
