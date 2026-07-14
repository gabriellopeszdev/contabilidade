'use client';

import Link from 'next/link';
import { Users, Building2, CheckSquare, CheckCircle2, Eye } from 'lucide-react';
import type { ComunicadoResumoContador, ComunicadoResumoCliente } from '../../hooks/useComunicados';

// =============================================================================
// Card para o CONTADOR
// =============================================================================

interface ComunicadoCardContadorProps {
  comunicado: ComunicadoResumoContador;
}

function badgeTargeting(targeting: string, setor: string | null, total: number) {
  if (targeting === 'TODOS') return 'Todos os clientes';
  if (targeting === 'SETOR') return `Setor ${setor}`;
  return `${total} cliente${total !== 1 ? 's' : ''} selecionado${total !== 1 ? 's' : ''}`;
}

export function ComunicadoCardContador({ comunicado: c }: ComunicadoCardContadorProps) {
  const progressoLidos = c.totalDestinatarios > 0 ? (c.totalLidos / c.totalDestinatarios) * 100 : 0;
  const progressoConf  = c.totalDestinatarios > 0 ? (c.totalConfirmados / c.totalDestinatarios) * 100 : 0;
  const TargetingIcon  = c.targeting === 'TODOS' ? Users : c.targeting === 'SETOR' ? Building2 : CheckSquare;

  return (
    <Link href={`/comunicados/${c.id}`}
      className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-primary hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.titulo}</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {new Date(c.publicadoAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span className="flex items-center gap-1 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[10px] font-medium text-gray-600 dark:text-gray-400">
          <TargetingIcon size={10} />
          {badgeTargeting(c.targeting, c.setor, c.totalDestinatarios)}
        </span>
      </div>

      {c.totalDestinatarios > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><Eye size={11} /> {c.totalLidos}/{c.totalDestinatarios} leram</span>
            <span>{Math.round(progressoLidos)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressoLidos}%` }} />
          </div>

          {c.exigeConfirmacao && (
            <>
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><CheckCircle2 size={11} /> {c.totalConfirmados}/{c.totalDestinatarios} confirmaram</span>
                <span>{Math.round(progressoConf)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressoConf}%` }} />
              </div>
            </>
          )}
        </div>
      )}
    </Link>
  );
}

// =============================================================================
// Card para o CLIENTE
// =============================================================================

interface ComunicadoCardClienteProps {
  comunicado: ComunicadoResumoCliente;
}

export function ComunicadoCardCliente({ comunicado: c }: ComunicadoCardClienteProps) {
  return (
    <Link href={`/informativos/${c.id}`}
      className={`block rounded-xl border p-4 hover:shadow-sm transition-all ${
        !c.lido && c.souDestinatario
          ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary'
      }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.titulo}</h3>
            {!c.lido && c.souDestinatario && (
              <span className="shrink-0 rounded-full bg-primary text-white text-[9px] font-bold px-2 py-0.5">NOVO</span>
            )}
            {c.exigeConfirmacao && !c.confirmado && c.souDestinatario && (
              <span className="shrink-0 rounded-full bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5">CONFIRMAR</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{c.conteudo}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
            {new Date(c.publicadoAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </Link>
  );
}
