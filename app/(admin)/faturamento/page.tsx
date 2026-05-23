'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  KeyRound,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface ContadorDTO {
  id:               string;
  name:             string;
  email:            string;
  crc:              string;
  isActive:         boolean;
  totalClientes:    number;
  nomeEscritorio:   string | null;
  asaasConfigurado: boolean;
  createdAt:        string;
}

interface Metricas {
  total:        number;
  ativos:       number;
  comAsaas:     number;
  totalClientes: number;
}

// =============================================================================
// Componentes auxiliares
// =============================================================================

function CardMetrica({
  label,
  valor,
  sub,
  icon: Icon,
  cor,
}: {
  label: string;
  valor: number | string;
  sub?:  string;
  icon:  React.ElementType;
  cor:   string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 font-medium">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${cor.replace('text-', 'bg-').replace('-400', '-900/30').replace('-300', '-900/30')}`}>
          <Icon size={18} className={cor} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Página
// =============================================================================

export default function FaturamentoPage() {
  const { token } = useAuth();

  const [contadores, setContadores] = useState<ContadorDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      setCarregando(true);
      try {
        const res = await fetch('/api/v1/admin/contadores', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { items: ContadorDTO[] };
        setContadores(data.items ?? []);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  const metricas: Metricas = {
    total:         contadores.length,
    ativos:        contadores.filter((c) => c.isActive).length,
    comAsaas:      contadores.filter((c) => c.asaasConfigurado).length,
    totalClientes: contadores.reduce((s, c) => s + c.totalClientes, 0),
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl px-5 py-4">
        <AlertCircle size={18} />
        <span className="text-sm">{erro}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-white">Faturamento SaaS</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Visão geral dos escritórios contratantes da plataforma.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <CardMetrica
          label="Total de Escritórios"
          valor={metricas.total}
          icon={Building2}
          cor="text-violet-400"
        />
        <CardMetrica
          label="Escritórios Ativos"
          valor={metricas.ativos}
          sub={`${metricas.total > 0 ? Math.round((metricas.ativos / metricas.total) * 100) : 0}% do total`}
          icon={CheckCircle2}
          cor="text-emerald-400"
        />
        <CardMetrica
          label="Integração Asaas"
          valor={metricas.comAsaas}
          sub={`${metricas.total > 0 ? Math.round((metricas.comAsaas / metricas.total) * 100) : 0}% configurado`}
          icon={KeyRound}
          cor="text-amber-400"
        />
        <CardMetrica
          label="Total de Clientes"
          valor={metricas.totalClientes}
          sub="somados de todos os escritórios"
          icon={Users}
          cor="text-sky-400"
        />
      </div>

      {/* Banner de planos futuros */}
      <div className="bg-violet-900/20 border border-violet-700/30 rounded-xl px-5 py-4 flex items-start gap-4">
        <div className="p-2 rounded-lg bg-violet-600/20 shrink-0">
          <TrendingUp size={18} className="text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-violet-300">Gestão de Planos — Em Breve</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Cobrança automática por escritório, gestão de planos (Básico / Pro / Enterprise)
            e relatórios de MRR serão disponibilizados em uma próxima versão.
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Escritórios Cadastrados</h2>
          <span className="text-xs text-slate-500">{metricas.total} registros</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-xs font-medium text-slate-400">Escritório / Contador</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-400">CRC</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-400 text-center">Status</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-400 text-center">Asaas</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-400 text-center">Clientes</th>
                <th className="px-5 py-3 text-xs font-medium text-slate-400">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {contadores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    Nenhum escritório cadastrado ainda.
                  </td>
                </tr>
              ) : (
                contadores.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-slate-100 font-medium truncate max-w-[220px]">
                        {c.nomeEscritorio ?? c.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{c.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{c.crc}</td>
                    <td className="px-5 py-3.5 text-center">
                      {c.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-900/30 border border-red-700/40 px-2 py-0.5 rounded-full">
                          <XCircle size={10} />
                          Bloqueado
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {c.asaasConfigurado ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded-full">
                          <CreditCard size={10} />
                          Ativo
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center text-slate-300 font-medium">
                      {c.totalClientes}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
