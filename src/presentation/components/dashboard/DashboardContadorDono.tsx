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
  AlarmClock,
  CheckCircle2,
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

interface ObrigacaoCritica {
  id:            string;
  nome:          string;
  vencimento:    string;
  diasRestantes: number;
  urgente:       boolean;
  clienteNome:   string;
  clienteId:     string;
}

interface PlanoAtual {
  planoNome:        string;
  limiteClientes:   number;
  limiteDocumentos: number;
  features:         string[];
  status:           string;
  isRestricted:     boolean;
}

// =============================================================================
// Fetchers
// =============================================================================

async function statsFetcher([url, token]: [string, string]): Promise<DashboardStats> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return res.json() as Promise<DashboardStats>;
}

async function obrigacoesFetcher([url, token]: [string, string]): Promise<{ obrigacoes: ObrigacaoCritica[]; total: number }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return res.json() as Promise<{ obrigacoes: ObrigacaoCritica[]; total: number }>;
}

async function planoFetcher([url, token]: [string, string]): Promise<{ plan: PlanoAtual }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return res.json() as Promise<{ plan: PlanoAtual }>;
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
  'aria-label'?: string;
}

function MetricCard({ label, valor, icone, cor, carregando, 'aria-label': ariaLabel }: MetricCardProps) {
  return (
    <div
      aria-label={ariaLabel ?? `${label}: ${valor ?? 0}`}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex items-center gap-4"
    >
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
  label:      string;
  icone:      React.ReactNode;
  cor:        string;
  onClick:    () => void;
  ariaLabel?: string;
}

function QuickAction({ label, icone, cor, onClick, ariaLabel }: QuickActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={`
        flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold text-white
        transition-all shadow-sm hover:shadow-md active:scale-[0.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${cor}
      `}
    >
      {icone}
      {label}
      <ArrowRight size={14} className="ml-auto opacity-70" aria-hidden="true" />
    </button>
  );
}

// =============================================================================
// PlanUsageWidget
// =============================================================================

interface UsageBarProps {
  label:   string;
  current: number | null;
  limit:   number;
}

function UsageBar({ label, current, limit }: UsageBarProps) {
  const unlimited = limit === -1;

  let pct = 0;
  if (!unlimited && current !== null && limit > 0) {
    pct = Math.min((current / limit) * 100, 100);
  } else if (unlimited) {
    pct = 100;
  }

  const barColor =
    unlimited
      ? 'bg-emerald-500'
      : pct > 90
      ? 'bg-red-500'
      : pct > 70
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  const currentLabel =
    current === null ? '—' : String(current);
  const limitLabel =
    unlimited ? '∞' : String(limit);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        {unlimited ? (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Sem limite</span>
        ) : (
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {currentLabel} / {limitLabel}
          </span>
        )}
      </div>
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PlanUsageWidget({
  token,
  clientesAtivos,
}: {
  token: string | null;
  clientesAtivos: number | undefined;
}) {
  const swrKey: [string, string] | null = token
    ? ['/api/v1/plano/atual', token]
    : null;

  const { data, isLoading } = useSWR(swrKey, planoFetcher, {
    revalidateOnFocus: false,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full" />
        <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded mt-2" />
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full" />
      </div>
    );
  }

  if (!data) return null;

  const { plan } = data;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
      {plan.isRestricted && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle size={14} className="text-red-500 shrink-0" aria-hidden="true" />
          <p className="text-xs font-semibold text-red-700 dark:text-red-400">
            Assinatura suspensa ou cancelada
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Uso do Plano</h3>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary-400">
          Plano {plan.planoNome}
        </span>
      </div>

      <div className="space-y-3">
        <UsageBar
          label="Clientes"
          current={clientesAtivos ?? null}
          limit={plan.limiteClientes}
        />
        <UsageBar
          label="Documentos"
          current={null}
          limit={plan.limiteDocumentos}
        />
      </div>
    </div>
  );
}

// =============================================================================
// ObrigacoesCriticasWidget
// =============================================================================

function ObrigacoesCriticasWidget({ token }: { token: string | null }) {
  const swrKey: [string, string] | null = token
    ? ['/api/v1/calendario/obrigacoes/criticas?dias=7', token]
    : null;

  const { data, isLoading } = useSWR(swrKey, obrigacoesFetcher, {
    refreshInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const obrigacoes = data?.obrigacoes?.slice(0, 5) ?? [];

  if (obrigacoes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 flex flex-col items-center justify-center gap-3 text-center">
        <CheckCircle2 size={32} className="text-emerald-500" aria-hidden="true" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sem obrigações críticas nos próximos 7 dias
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
      {obrigacoes.map((ob) => {
        const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date(ob.vencimento));

        const badgeDias =
          ob.diasRestantes <= 3
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

        return (
          <div key={ob.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {ob.nome}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {ob.clienteNome}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ob.urgente && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  Urgente
                </span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeDias}`}>
                {ob.diasRestantes}d
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {dataFormatada}
              </span>
            </div>
          </div>
        );
      })}
    </div>
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
          <AlertCircle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
          <p className="text-sm text-red-700">Falha ao carregar métricas. Tente novamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <MetricCard
            label="Clientes Ativos"
            valor={stats?.clientesAtivos}
            icone={<Users size={22} className="text-primary dark:text-primary" />}
            cor="bg-primary/5 dark:bg-primary/10"
            carregando={isLoading}
          />
        </div>
      )}

      <PlanUsageWidget token={token} clientesAtivos={stats?.clientesAtivos} />

      <div className="grid grid-cols-2 gap-3">
        <QuickAction
          label="Novo Upload em Lote"
          ariaLabel="Ir para upload de documentos em lote"
          icone={<Upload size={18} aria-hidden="true" />}
          cor="bg-primary hover:brightness-90 focus-visible:ring-primary"
          onClick={() => router.push('/lote')}
        />
        <QuickAction
          label="Adicionar Cliente"
          ariaLabel="Ir para cadastro de novo cliente"
          icone={<UserPlus size={18} aria-hidden="true" />}
          cor="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
          onClick={() => router.push('/clientes')}
        />
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <AlarmClock size={16} className="text-gray-400 dark:text-gray-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Obrigações Próximas</h2>
        </div>
        <ObrigacoesCriticasWidget token={token} />
      </section>

      <DashboardCharts token={token} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList size={16} className="text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Fluxo de Trabalho</h2>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
              <ClipboardList size={26} className="text-violet-600 dark:text-violet-400" aria-hidden="true" />
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
              aria-label="Abrir painel Kanban de tarefas"
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              Abrir Kanban
              <ArrowRight size={14} aria-hidden="true" />
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
