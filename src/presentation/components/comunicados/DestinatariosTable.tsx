'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, Minus, Loader2 } from 'lucide-react';

interface Destinatario {
  clienteId:    string;
  nome:         string;
  email:        string;
  lido:         boolean;
  lidoAt:       string | null;
  confirmado:   boolean;
  confirmadoAt: string | null;
}

interface DestinatariosTableProps {
  comunicadoId:     string;
  exigeConfirmacao: boolean;
  token:            string;
}

export function DestinatariosTable({ comunicadoId, exigeConfirmacao, token }: DestinatariosTableProps) {
  const [items, setItems]     = useState<Destinatario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/comunicados/${comunicadoId}/destinatarios`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: { items?: Destinatario[] }) => setItems(d.items ?? []))
      .catch(() => setError('Erro ao carregar destinatários.'))
      .finally(() => setLoading(false));
  }, [comunicadoId, token]);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={20} className="animate-spin text-primary" />
    </div>
  );

  if (error) return <p className="text-xs text-red-500 py-4">{error}</p>;

  if (items.length === 0) return (
    <p className="text-xs text-gray-400 py-4">Nenhum destinatário registrado.</p>
  );

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((d) => (
          <li key={d.clienteId} className="p-4 space-y-1">
            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{d.nome}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{d.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              {d.lido ? `Lido em ${fmt(d.lidoAt)}` : 'Não lido'}
              {exigeConfirmacao && ` · ${d.confirmado ? `Confirmado em ${fmt(d.confirmadoAt)}` : 'Sem confirmação'}`}
            </p>
          </li>
        ))}
      </ul>
      <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <th className="px-4 py-2.5">Cliente</th>
            <th className="px-4 py-2.5">Leitura</th>
            {exigeConfirmacao && <th className="px-4 py-2.5">Confirmação</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((d) => (
            <tr key={d.clienteId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{d.nome}</p>
                <p className="text-gray-400 dark:text-gray-500 truncate max-w-[200px]">{d.email}</p>
              </td>
              <td className="px-4 py-3">
                {d.lido ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Eye size={12} /> Lido em {fmt(d.lidoAt)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-400"><Minus size={12} /> Não lido</span>
                )}
              </td>
              {exigeConfirmacao && (
                <td className="px-4 py-3">
                  {d.confirmado ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 size={12} /> Confirmado em {fmt(d.confirmadoAt)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400"><Minus size={12} /> Pendente</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
