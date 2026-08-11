'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Scale, ArrowRight } from 'lucide-react';

interface Resumo {
  pendentes: number;
  totalAplicaveis: number;
}

interface Payload {
  prazoFim: string;
  fase: 'ANTES' | 'ABERTA' | 'REVERSAO' | 'ENCERRADA';
  competencia: string;
  resumo: Resumo;
}

async function fetcher([url, token]: [string, string]): Promise<Payload> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) throw new Error('fail');
  return res.json() as Promise<Payload>;
}

function br(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function BannerIbsCbs({ token }: { token: string | null }) {
  const key: [string, string] | null = token ? ['/api/v1/reforma-ibs-cbs', token] : null;
  const { data } = useSWR(key, fetcher, { revalidateOnFocus: true, refreshInterval: 60_000 });

  if (!data || data.resumo.totalAplicaveis === 0) return null;
  if (data.fase === 'ENCERRADA' && data.resumo.pendentes === 0) return null;

  const urgente = data.fase === 'ABERTA' || data.fase === 'REVERSAO';

  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
        urgente
          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
          : 'bg-primary/5 dark:bg-primary/10 border-primary/20'
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Scale size={18} className={urgente ? 'text-amber-700 dark:text-amber-300 mt-0.5 shrink-0' : 'text-primary mt-0.5 shrink-0'} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            IBS/CBS · {data.resumo.pendentes} cliente{data.resumo.pendentes === 1 ? '' : 's'} pendente{data.resumo.pendentes === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Competência {data.competencia} · prazo até {br(data.prazoFim)}
          </p>
        </div>
      </div>
      <Link
        href="/reforma-ibs-cbs"
        className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-primary text-white hover:brightness-90 shrink-0"
      >
        Registrar decisões
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}
