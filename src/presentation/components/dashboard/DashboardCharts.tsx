'use client';

import useSWR from 'swr';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp, RefreshCw, AlertCircle, Zap } from 'lucide-react';

// =============================================================================
// Tipos
// =============================================================================

interface ChartEntry {
  nome:  string;
  valor: number;
  cor:   string;
}

interface VolumeEntry {
  mes:   string;
  label: string;
  total: number;
}

interface EfficiencyEntry {
  mes:        string;
  label:      string;
  criadas:    number;
  concluidas: number;
}

interface ChartsData {
  tarefasPorStatus:  ChartEntry[];
  tarefasPorSetor:   ChartEntry[];
  documentosPorMes:  VolumeEntry[];
  eficienciaPorMes?: EfficiencyEntry[];
}

// =============================================================================
// Fetcher
// =============================================================================

async function fetcher([url, token]: [string, string]): Promise<ChartsData> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return res.json() as Promise<ChartsData>;
}

// =============================================================================
// Custom tooltip para o PieChart
// =============================================================================

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-gray-800">{payload[0].name}</p>
      <p className="text-sm font-bold text-gray-900">{payload[0].value} tarefa{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
}

// =============================================================================
// Custom tooltip para o BarChart
// =============================================================================

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900">{payload[0].value} documento{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
}

// =============================================================================
// Custom legend label
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLegend(props: any) {
  const payload = props?.payload as Array<{ value?: string; color?: string }> | undefined;
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {payload.map((entry, index) => (
        <span key={`leg-${index}`} className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color ?? '#6b7280' }} />
          {entry.value ?? ''}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// Componente: DashboardCharts
// =============================================================================

interface DashboardChartsProps {
  token: string | null;
}

export function DashboardCharts({ token }: DashboardChartsProps) {
  const swrKey: [string, string] | null =
    token ? ['/api/v1/dashboard/charts', token] : null;

  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
        <AlertCircle size={18} className="text-red-500 shrink-0" />
        <p className="text-sm text-red-700">Falha ao carregar gráficos.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-72 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-gray-300" />
          </div>
        ))}
      </div>
    );
  }

  const { tarefasPorStatus, tarefasPorSetor, documentosPorMes, eficienciaPorMes } = data;

  const totalTarefasStatus = tarefasPorStatus.reduce((a, b) => a + b.valor, 0);
  const totalTarefasSetor  = tarefasPorSetor.reduce((a, b) => a + b.valor, 0);

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* ------------------------------------------------------------------ */}
      {/* Gráfico 1: Pizza — Tarefas por Status                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieIcon size={15} className="text-violet-500" />
          <h3 className="text-sm font-bold text-gray-900">Tarefas por Status</h3>
          <span className="ml-auto text-xs text-gray-400">{totalTarefasStatus} total</span>
        </div>

        {totalTarefasStatus === 0 ? (
          <div className="h-52 flex items-center justify-center text-xs text-gray-400">
            Nenhuma tarefa registrada
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={tarefasPorStatus}
                dataKey="valor"
                nameKey="nome"
                cx="50%"
                cy="45%"
                outerRadius={75}
                innerRadius={40}
                paddingAngle={3}
                stroke="none"
              >
                {tarefasPorStatus.map((entry, i) => (
                  <Cell key={`status-${i}`} fill={entry.cor} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Gráfico 2: Pizza — Tarefas por Setor                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={15} className="text-teal-500" />
          <h3 className="text-sm font-bold text-gray-900">Tarefas por Setor</h3>
          <span className="ml-auto text-xs text-gray-400">{totalTarefasSetor} total</span>
        </div>

        {totalTarefasSetor === 0 ? (
          <div className="h-52 flex items-center justify-center text-xs text-gray-400">
            Nenhuma tarefa com setor definido
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={tarefasPorSetor}
                dataKey="valor"
                nameKey="nome"
                cx="50%"
                cy="45%"
                outerRadius={75}
                innerRadius={40}
                paddingAngle={3}
                stroke="none"
              >
                {tarefasPorSetor.map((entry, i) => (
                  <Cell key={`setor-${i}`} fill={entry.cor} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Gráfico 3: Barras — Volume Mensal de Documentos                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={15} className="text-blue-500" />
          <h3 className="text-sm font-bold text-gray-900">Documentos / Mês</h3>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={documentosPorMes} barCategoryGap="20%">
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#3b82f6" maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

      {/* ------------------------------------------------------------------ */}
      {/* Gráfico 4: Barras Agrupadas — Eficiência da Equipe                 */}
      {/* ------------------------------------------------------------------ */}
      {eficienciaPorMes && eficienciaPorMes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} className="text-amber-500" />
            <h3 className="text-sm font-bold text-gray-900">Eficiência da Equipe</h3>
            <span className="ml-auto text-xs text-gray-400">Tarefas Criadas vs Concluídas</span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={eficienciaPorMes} barCategoryGap="20%">
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      {payload.map((p, i) => (
                        <p key={i} className="text-xs">
                          <span className="font-bold" style={{ color: p.color }}>{p.name}: </span>
                          {p.value}
                        </p>
                      ))}
                    </div>
                  );
                }}
                cursor={{ fill: 'rgba(245, 158, 11, 0.06)' }}
              />
              <Legend content={renderLegend} />
              <Bar dataKey="criadas" name="Criadas" radius={[6, 6, 0, 0]} fill="#9ca3af" maxBarSize={30} />
              <Bar dataKey="concluidas" name="Concluídas" radius={[6, 6, 0, 0]} fill="#10b981" maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
