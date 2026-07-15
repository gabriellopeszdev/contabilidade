'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, AlertTriangle, Users, RefreshCw, Calendar, DollarSign } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

// Tipos baseados no response do endpoint
interface ReceitaData {
  mrr: number;
  porPlano: { planoId: string; planoNome: string; total: number }[];
  porStatus: Record<string, number>;
  conversaoTrial: { periodo: number; triaisIniciados: number; convertidos: number; taxa: number }[];
  churnMes: { canceladosNesteMes: number; ativasNoInicio: number; taxa: number };
  proximosVencimentos: { id: string; escritorioNome: string; dataRenovacao: string; valorMensal: number }[];
  receitaMensal: { mes: string; total: number }[];
}

export default function ReceitaPage() {
  const { token } = useAuth();

  const { data, isLoading, error, mutate } = useSWR<ReceitaData>(
    token ? ['/api/v1/admin/receita', token] : null,
    async ([url, t]: [string, string]) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error('Erro ao carregar dados');
      return res.json();
    },
  );

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const mesLabel = (mes: string) => {
    const [ano, m] = mes.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(m, 10) - 1]}/${ano?.slice(2)}`;
  };

  const receitaComLabel = useMemo(
    () => (data?.receitaMensal ?? []).map(r => ({ ...r, label: mesLabel(r.mes) })),
    [data?.receitaMensal],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-slate-400 text-sm">Erro ao carregar dados de receita.</p>
        <button onClick={() => mutate()} className="text-violet-400 text-sm hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  const triaisAtivos = data.porStatus['TRIAL'] ?? 0;
  const totalAtivos  = data.porStatus['ATIVO'] ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Receita SaaS</h1>
          <p className="text-sm text-slate-400 mt-0.5">Métricas financeiras do FiscoHub</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
        >
          <RefreshCw size={13} />
          Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="MRR"
          value={formatBRL(data.mrr)}
          accent="violet"
        />
        <StatCard
          icon={Users}
          label="Assinaturas Ativas"
          value={String(totalAtivos)}
          accent="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Em Trial"
          value={String(triaisAtivos)}
          accent="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label="Churn do Mês"
          value={`${data.churnMes.taxa}%`}
          sub={`${data.churnMes.canceladosNesteMes} cancelamentos`}
          accent="rose"
        />
      </div>

      {/* Gráfico de receita mensal */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Receita dos Últimos 6 Meses</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={receitaComLabel} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#cbd5e1' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [formatBRL(Number(v ?? 0)), 'Receita']}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ fill: '#7c3aed', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Distribuição por plano e status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por plano */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Assinantes por Plano</h2>
          <div className="space-y-2">
            {data.porPlano.map(p => (
              <div key={p.planoId} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{p.planoNome}</span>
                <span className="font-semibold text-violet-300">{p.total}</span>
              </div>
            ))}
            {data.porPlano.length === 0 && (
              <p className="text-slate-500 text-xs">Nenhuma assinatura ativa.</p>
            )}
          </div>
        </div>

        {/* Por status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Distribuição por Status</h2>
          <div className="space-y-2">
            {(['TRIAL','ATIVO','INADIMPLENTE','SUSPENSO','CANCELADO'] as const).map(s => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{s}</span>
                <span className="font-semibold text-slate-100">{data.porStatus[s] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Taxa de conversão trial */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-3">Conversão Trial → Ativo</h2>
        <div className="grid grid-cols-3 gap-4">
          {data.conversaoTrial.map(c => (
            <div key={c.periodo} className="text-center">
              <p className="text-2xl font-bold text-violet-300">{c.taxa}%</p>
              <p className="text-xs text-slate-400 mt-1">{c.periodo} dias</p>
              <p className="text-[10px] text-slate-500">{c.convertidos}/{c.triaisIniciados} trials</p>
            </div>
          ))}
        </div>
      </div>

      {/* Próximos vencimentos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <Calendar size={15} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">Vencimentos nos Próximos 7 Dias</h2>
        </div>
        {data.proximosVencimentos.length === 0 ? (
          <div className="px-5 py-6 text-center text-slate-500 text-sm">Nenhum vencimento nos próximos 7 dias.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-800">
                <th className="px-5 py-3 font-medium">Escritório</th>
                <th className="px-5 py-3 font-medium">Vencimento</th>
                <th className="px-5 py-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.proximosVencimentos.map(v => (
                <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-slate-200">{v.escritorioNome}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(v.dataRenovacao).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3 text-right text-violet-300 font-medium">
                    {formatBRL(v.valorMensal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({ icon: Icon, label, value, sub, accent = 'violet' }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: 'violet' | 'emerald' | 'blue' | 'rose';
}) {
  const accents = {
    violet:  'text-violet-400 bg-violet-600/15',
    emerald: 'text-emerald-400 bg-emerald-600/15',
    blue:    'text-blue-400 bg-blue-600/15',
    rose:    'text-rose-400 bg-rose-600/15',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className={`inline-flex p-2 rounded-lg ${accents[accent]} mb-3`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}
