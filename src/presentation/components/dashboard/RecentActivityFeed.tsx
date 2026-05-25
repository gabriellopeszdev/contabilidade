'use client';

import useSWR from 'swr';
import {
  Download,
  Eye,
  Upload,
  LogIn,
  LogOut,
  RefreshCw,
  AlertCircle,
  Activity,
  type LucideIcon,
} from 'lucide-react';

// =============================================================================
// Tipos
// =============================================================================

interface AtividadeDTO {
  id:           string;
  usuario:      string;
  acao:         string;
  actionType:   string;
  resourceType: string;
  arquivo:      string | null;
  timestamp:    string;
}

// =============================================================================
// SWR Fetcher
// =============================================================================

async function fetcher([url, token]: [string, string]): Promise<{ atividades: AtividadeDTO[] }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return res.json() as Promise<{ atividades: AtividadeDTO[] }>;
}

// =============================================================================
// Ícone por tipo de ação
// =============================================================================

const ACTION_ICONS: Record<string, { icon: LucideIcon; cor: string }> = {
  DOWNLOAD:     { icon: Download,  cor: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  VIEW:         { icon: Eye,       cor: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20' },
  UPLOAD_BATCH: { icon: Upload,    cor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
  LOGIN:        { icon: LogIn,     cor: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  LOGOUT:       { icon: LogOut,    cor: 'text-gray-500 bg-gray-50 dark:bg-gray-700' },
  STATE_CHANGE: { icon: RefreshCw, cor: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
};

const DEFAULT_ICON = { icon: Activity, cor: 'text-gray-400 bg-gray-50 dark:bg-gray-700' };

// =============================================================================
// Helpers
// =============================================================================

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seg = Math.floor(diff / 1000);
  if (seg < 60) return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `há ${dias}d`;
}

// =============================================================================
// RecentActivityFeed
// =============================================================================

interface RecentActivityFeedProps {
  token: string | null;
}

export function RecentActivityFeed({ token }: RecentActivityFeedProps) {
  const swrKey: [string, string] | null =
    token ? ['/api/v1/dashboard/activity?limit=15', token] : null;

  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const atividades = data?.atividades ?? [];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <Activity size={15} className="text-gray-400 dark:text-gray-500" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Atividade Recente</h3>
      </div>

      {/* Conteúdo */}
      {error ? (
        <div className="p-6 flex flex-col items-center gap-2 text-center">
          <AlertCircle size={20} className="text-red-400" />
          <p className="text-xs text-gray-500">Falha ao carregar atividades</p>
        </div>
      ) : isLoading ? (
        <div className="p-6 flex justify-center">
          <RefreshCw size={18} className="animate-spin text-gray-300" />
        </div>
      ) : atividades.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-xs text-gray-400">Nenhuma atividade registrada</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[400px] overflow-y-auto">
          {atividades.map((a) => {
            const config = ACTION_ICONS[a.actionType] ?? DEFAULT_ICON;
            const Icon = config.icon;
            return (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${config.cor}`}>
                  <Icon size={13} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-800 dark:text-gray-200 leading-snug">
                    <span className="font-semibold">{a.usuario}</span>{' '}
                    {a.acao}
                    {a.arquivo && (
                      <span className="text-gray-500 dark:text-gray-400"> — <span className="font-medium">{a.arquivo}</span></span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{tempoRelativo(a.timestamp)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
