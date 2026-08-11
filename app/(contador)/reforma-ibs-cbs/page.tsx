'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Scale,
  Loader2,
  AlertCircle,
  Search,
  Megaphone,
  CheckCircle2,
  Clock,
  Ban,
  MinusCircle,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import type { StatusIbsCbs, FaseJanelaIbsCbs, TipoJanelaIbsCbs } from '../../../src/utils/ibsCbs';

interface ClienteIbs {
  id: string;
  nome: string;
  cnpj: string | null;
  regimeTributario: string | null;
  aplicavel: boolean;
  status: StatusIbsCbs;
  decididoEm: string | null;
  observacao: string | null;
}

interface ReformaResponse {
  prazoInicio: string;
  prazoFim: string;
  reversaoAte: string;
  vigencia: string;
  vigenciaFim: string;
  competencia: string;
  tipo: TipoJanelaIbsCbs;
  fase: FaseJanelaIbsCbs;
  resumo: {
    totalAplicaveis: number;
    pendentes: number;
    dentroDas: number;
    foraDas: number;
    naoSeAplica: number;
    total: number;
  };
  clientes: ClienteIbs[];
}

type Filtro = 'APLICAVEIS' | 'PENDENTES' | 'DECIDIDOS' | 'TODOS';

const BTN_44 = 'min-h-[44px] min-w-[44px]';

function br(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatarCNPJ(doc: string | null): string {
  if (!doc) return '—';
  const d = doc.replace(/\D/g, '');
  if (d.length !== 14) return doc;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function labelFase(fase: FaseJanelaIbsCbs): string {
  if (fase === 'ANTES') return 'Janela ainda não abriu';
  if (fase === 'ABERTA') return 'Janela aberta';
  if (fase === 'REVERSAO') return 'Prazo de reversão';
  return 'Janela encerrada';
}

function labelStatus(s: StatusIbsCbs): { texto: string; classe: string } {
  if (s === 'PENDENTE') return { texto: 'Pendente', classe: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' };
  if (s === 'DENTRO_DAS') return { texto: 'Dentro do DAS', classe: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' };
  if (s === 'FORA_DAS') return { texto: 'Fora do DAS', classe: 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300' };
  return { texto: 'Não se aplica', classe: 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400' };
}

async function fetcher([url, token]: [string, string]): Promise<ReformaResponse> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return res.json() as Promise<ReformaResponse>;
}

export default function ReformaIbsCbsPage() {
  const { token, isFuncionarioEscritorio } = useAuth();
  const [filtro, setFiltro] = useState<Filtro>('APLICAVEIS');
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [avisando, setAvisando] = useState(false);

  const swrKey: [string, string] | null = token ? ['/api/v1/reforma-ibs-cbs', token] : null;
  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, { revalidateOnFocus: true });

  const visiveis = useMemo(() => {
    if (!data) return [];
    const q = busca.trim().toLowerCase();
    return data.clientes.filter((c) => {
      if (filtro === 'APLICAVEIS' && !c.aplicavel) return false;
      if (filtro === 'PENDENTES' && !(c.aplicavel && c.status === 'PENDENTE')) return false;
      if (filtro === 'DECIDIDOS' && !(c.status === 'DENTRO_DAS' || c.status === 'FORA_DAS')) return false;
      if (q && !c.nome.toLowerCase().includes(q) && !(c.cnpj ?? '').includes(q.replace(/\D/g, ''))) return false;
      return true;
    });
  }, [data, filtro, busca]);

  const patchStatus = useCallback(async (clienteId: string, status: StatusIbsCbs) => {
    if (!token) return;
    setSalvando(clienteId);
    try {
      const res = await fetch(`/api/v1/reforma-ibs-cbs/${clienteId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `Erro HTTP ${res.status}`);
      }
      await mutate();
      toast.success('Decisão registrada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSalvando(null);
    }
  }, [token, mutate]);

  const avisarPendentes = useCallback(async () => {
    if (!token || isFuncionarioEscritorio) return;
    setAvisando(true);
    try {
      const res = await fetch('/api/v1/reforma-ibs-cbs/avisar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({})) as { message?: string; totalDestinatarios?: number };
      if (!res.ok) throw new Error(body.message ?? `Erro HTTP ${res.status}`);
      const n = body.totalDestinatarios ?? 0;
      toast.success(n === 0 ? 'Nenhum cliente pendente para avisar.' : `Comunicado enviado a ${n} cliente${n === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar comunicado.');
    } finally {
      setAvisando(false);
    }
  }, [token, isFuncionarioEscritorio]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        {error ? (
          <p className="text-sm text-red-600">Falha ao carregar o rastreador.</p>
        ) : (
          <Loader2 size={28} className="animate-spin text-primary" aria-label="Carregando" />
        )}
      </div>
    );
  }

  const { resumo, fase } = data;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
            <Scale size={20} className="text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">IBS / CBS — Simples e MEI</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Competência {data.competencia} · {labelFase(fase)} · opção {br(data.prazoInicio)} a {br(data.prazoFim)}
            </p>
          </div>
        </div>
        {!isFuncionarioEscritorio && (
          <button
            type="button"
            onClick={avisarPendentes}
            disabled={avisando || resumo.pendentes === 0}
            className={`${BTN_44} inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 text-sm font-semibold text-white bg-primary rounded-xl hover:brightness-90 disabled:opacity-50`}
          >
            {avisando ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
            Avisar pendentes ({resumo.pendentes})
          </button>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
        <p>
          Quem não se manifestar permanece no DAS. A escolha vale de <strong>{br(data.vigencia)}</strong> a{' '}
          <strong>{br(data.vigenciaFim)}</strong>. Reversão até <strong>{br(data.reversaoAte)}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ResumoCard label="Pendentes" valor={resumo.pendentes} icone={<Clock size={18} />} cor="text-amber-600" />
        <ResumoCard label="Dentro do DAS" valor={resumo.dentroDas} icone={<CheckCircle2 size={18} />} cor="text-emerald-600" />
        <ResumoCard label="Fora do DAS" valor={resumo.foraDas} icone={<Ban size={18} />} cor="text-sky-600" />
        <ResumoCard label="Não se aplica" valor={resumo.naoSeAplica} icone={<MinusCircle size={18} />} cor="text-slate-500" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <label htmlFor="busca-ibs" className="sr-only">Buscar cliente</label>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="busca-ibs"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou CNPJ"
            className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtro de clientes">
          {([
            ['APLICAVEIS', 'Simples/MEI'],
            ['PENDENTES', 'Pendentes'],
            ['DECIDIDOS', 'Decididos'],
            ['TODOS', 'Todos'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filtro === id}
              onClick={() => setFiltro(id)}
              className={`${BTN_44} px-3 rounded-xl text-xs font-semibold ${
                filtro === id
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle size={16} /> Falha ao atualizar. Recarregue a página.
        </div>
      )}

      {visiveis.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum cliente neste filtro.</p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((c) => {
            const badge = labelStatus(c.status);
            const busy = salvando === c.id;
            return (
              <li
                key={c.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{c.nome}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {formatarCNPJ(c.cnpj)} · {c.regimeTributario ?? 'Regime não informado'}
                    </p>
                  </div>
                  <span className={`inline-flex self-start text-[11px] font-semibold px-2 py-1 rounded-full ${badge.classe}`}>
                    {badge.texto}
                  </span>
                </div>
                {c.aplicavel && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || c.status === 'DENTRO_DAS'}
                      onClick={() => patchStatus(c.id, 'DENTRO_DAS')}
                      className={`${BTN_44} px-3 rounded-xl text-xs font-semibold bg-emerald-600 text-white disabled:opacity-40`}
                    >
                      Dentro do DAS
                    </button>
                    <button
                      type="button"
                      disabled={busy || c.status === 'FORA_DAS'}
                      onClick={() => patchStatus(c.id, 'FORA_DAS')}
                      className={`${BTN_44} px-3 rounded-xl text-xs font-semibold bg-sky-600 text-white disabled:opacity-40`}
                    >
                      Fora do DAS
                    </button>
                    <button
                      type="button"
                      disabled={busy || c.status === 'NAO_SE_APLICA'}
                      onClick={() => patchStatus(c.id, 'NAO_SE_APLICA')}
                      className={`${BTN_44} px-3 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-slate-200 disabled:opacity-40`}
                    >
                      Não se aplica
                    </button>
                    {c.status !== 'PENDENTE' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => patchStatus(c.id, 'PENDENTE')}
                        className={`${BTN_44} px-3 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800`}
                      >
                        Limpar
                      </button>
                    )}
                    {busy && <Loader2 size={16} className="animate-spin text-primary self-center" />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ResumoCard({
  label, valor, icone, cor,
}: { label: string; valor: number; icone: ReactNode; cor: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 p-4">
      <div className={`mb-2 ${cor}`} aria-hidden="true">{icone}</div>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{valor}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
