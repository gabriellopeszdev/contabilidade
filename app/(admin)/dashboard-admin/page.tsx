'use client';

import { useState, useEffect } from 'react';
import {
  Building2, Users, CreditCard, KeyRound,
  Receipt, TrendingUp, Activity, Loader2,
  AlertCircle, CheckCircle2, Clock, XCircle,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface Stats {
  totalEscritorios:     number;
  escritoriosAtivos:    number;
  escritoriosBloqueados: number;
  comAsaas:             number;
  totalClientes:        number;
  boletosEmAberto:      number;
  valorEmAberto:        number;
  boletosPagosMes:      number;
  valorPagoMes:         number;
  assinaturasAtivas:    number;
  totalWebhooks:        number;
}

interface WebhookLog {
  id:          string;
  eventKey:    string;
  processedAt: string;
}

// =============================================================================
// Helpers
// =============================================================================

function fmt(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function eventColor(eventType: string): string {
  if (eventType.includes('RECEIVED') || eventType.includes('CONFIRMED')) return 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40';
  if (eventType.includes('OVERDUE'))   return 'text-amber-400 bg-amber-900/30 border-amber-700/40';
  if (eventType.includes('DELETED') || eventType.includes('REFUNDED') || eventType.includes('CHARGEBACK')) return 'text-red-400 bg-red-900/30 border-red-700/40';
  if (eventType.includes('SUBSCRIPTION')) return 'text-violet-400 bg-violet-900/30 border-violet-700/40';
  if (eventType.includes('CREATED'))   return 'text-sky-400 bg-sky-900/30 border-sky-700/40';
  return 'text-slate-400 bg-slate-800 border-slate-700/40';
}

// =============================================================================
// Componentes
// =============================================================================

function KpiCard({ label, valor, sub, icon: Icon, cor, bg }: {
  label: string;
  valor: string | number;
  sub?:  string;
  icon:  React.ElementType;
  cor:   string;
  bg:    string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400 font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg shrink-0 ${bg}`}>
          <Icon size={18} className={cor} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Página
// =============================================================================

export default function DashboardAdminPage() {
  const { token } = useAuth();

  const [stats,     setStats]     = useState<Stats | null>(null);
  const [webhooks,  setWebhooks]  = useState<WebhookLog[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [erro,      setErro]      = useState<string | null>(null);
  const [retryKey,  setRetryKey]  = useState(0);

  useEffect(() => {
    if (!token) return;

    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const [statsRes, wRes] = await Promise.all([
          fetch('/api/v1/admin/stats',                             { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/v1/admin/webhook-logs?limit=8&page=1', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!statsRes.ok) throw new Error(`Stats: HTTP ${statsRes.status}`);
        setStats(await statsRes.json() as Stats);

        if (wRes.ok) {
          const wData = await wRes.json() as { logs: WebhookLog[] };
          setWebhooks(wData.logs ?? []);
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, retryKey]);

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-violet-400" />
        <span className="sr-only">Carregando...</span>
      </div>
    );
  }

  if (erro || !stats) {
    return (
      <div className="flex flex-col items-start gap-3 bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl px-5 py-4">
        <div className="flex items-center gap-3">
          <AlertCircle size={18} />
          <span className="text-sm">{erro ?? 'Sem dados.'}</span>
        </div>
        <button
          type="button"
          onClick={() => setRetryKey(k => k + 1)}
          className="mt-2 px-4 py-2 text-sm font-semibold text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Visão geral da plataforma em tempo real.</p>
      </div>

      {/* KPIs — Escritórios */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Escritórios</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total"     valor={stats.totalEscritorios}  icon={Building2}    cor="text-violet-400" bg="bg-violet-900/30" />
          <KpiCard label="Ativos"    valor={stats.escritoriosAtivos}  icon={CheckCircle2} cor="text-emerald-400" bg="bg-emerald-900/30"
            sub={`${stats.totalEscritorios > 0 ? Math.round(stats.escritoriosAtivos / stats.totalEscritorios * 100) : 0}% do total`} />
          <KpiCard label="Bloqueados" valor={stats.escritoriosBloqueados} icon={XCircle}  cor="text-red-400"   bg="bg-red-900/30" />
          <KpiCard label="Com Asaas"  valor={stats.comAsaas}           icon={KeyRound}    cor="text-amber-400"  bg="bg-amber-900/30"
            sub={`${stats.totalEscritorios > 0 ? Math.round(stats.comAsaas / stats.totalEscritorios * 100) : 0}% integrado`} />
        </div>
      </div>

      {/* KPIs — Financeiro */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Financeiro</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Clientes cadastrados" valor={stats.totalClientes} icon={Users}       cor="text-sky-400"    bg="bg-sky-900/30" />
          <KpiCard label="Boletos em aberto"    valor={stats.boletosEmAberto} icon={Clock}     cor="text-orange-400" bg="bg-orange-900/30"
            sub={fmt(stats.valorEmAberto)} />
          <KpiCard label={`Pagos em ${mesAtual}`} valor={stats.boletosPagosMes} icon={Receipt} cor="text-emerald-400" bg="bg-emerald-900/30"
            sub={fmt(stats.valorPagoMes)} />
          <KpiCard label="Assinaturas ativas"   valor={stats.assinaturasAtivas} icon={TrendingUp} cor="text-violet-400" bg="bg-violet-900/30" />
        </div>
      </div>

      {/* Últimos Webhooks */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-100">Últimos Webhooks Recebidos</h2>
          </div>
          <a href="/webhook-logs" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Ver todos →
          </a>
        </div>

        {webhooks.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            Nenhum evento recebido ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {webhooks.map((w) => {
              const [evType, resourceId] = w.eventKey.split(':');
              return (
                <div key={w.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/30 transition-colors">
                  <span className={`text-[10px] font-mono font-medium border px-2 py-0.5 rounded shrink-0 ${eventColor(evType)}`}>
                    {evType}
                  </span>
                  <span className="text-xs font-mono text-slate-500 truncate flex-1">{resourceId}</span>
                  <span className="text-xs text-slate-600 shrink-0">
                    {new Date(w.processedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stat total webhooks */}
      <p className="text-xs text-slate-600 text-right">
        {stats.totalWebhooks.toLocaleString('pt-BR')} eventos de webhook processados no total
      </p>
    </div>
  );
}
