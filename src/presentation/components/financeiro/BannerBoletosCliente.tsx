'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, DollarSign } from 'lucide-react';

// =============================================================================
// BannerBoletosCliente — Mostra alerta se há boletos vencidos ou vencendo hoje
// =============================================================================

interface Boleto {
  id: string;
  valor: number;
  vencimento: string;
  status: string;
}

interface Props {
  token: string | null | undefined;
}

export function BannerBoletosCliente({ token }: Props) {
  const [vencidos, setVencidos] = useState(0);
  const [venceHoje, setVenceHoje] = useState(0);
  const [valorVencido, setValorVencido] = useState(0);

  useEffect(() => {
    if (!token) return;

    fetch('/api/v1/financeiro/boletos?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const boletos: Boleto[] = data.boletos ?? [];
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let venc = 0;
        let hj = 0;
        let valorV = 0;

        for (const b of boletos) {
          if (b.status !== 'PENDENTE' && b.status !== 'VENCIDO') continue;
          const d = new Date(b.vencimento);
          d.setHours(0, 0, 0, 0);

          if (d < hoje) {
            venc++;
            valorV += b.valor;
          } else if (d.getTime() === hoje.getTime()) {
            hj++;
          }
        }

        setVencidos(venc);
        setVenceHoje(hj);
        setValorVencido(valorV);
      })
      .catch(() => {});
  }, [token]);

  if (vencidos === 0 && venceHoje === 0) return null;

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-2">
      {vencidos > 0 && (
        <Link
          href="/financeiro"
          className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100/60 dark:hover:bg-red-900/30 transition-colors"
        >
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {vencidos} boleto{vencidos > 1 ? 's' : ''} de honorários vencido{vencidos > 1 ? 's' : ''} ({formatCurrency(valorVencido)})
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Clique para ver seus boletos</p>
          </div>
          <DollarSign size={16} className="text-red-400 shrink-0" />
        </Link>
      )}

      {venceHoje > 0 && (
        <Link
          href="/financeiro"
          className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
        >
          <Clock size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {venceHoje} boleto{venceHoje > 1 ? 's' : ''} vence{venceHoje > 1 ? 'm' : ''} hoje!
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Clique para ver seus boletos</p>
          </div>
          <DollarSign size={16} className="text-amber-400 shrink-0" />
        </Link>
      )}
    </div>
  );
}
