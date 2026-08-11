'use client';

import { useCallback } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { useComunicadosCliente, type PayloadNovoComunicado } from '../../../src/presentation/hooks/useComunicados';
import { ComunicadoCardCliente } from '../../../src/presentation/components/comunicados/ComunicadoCard';

export default function InformativosPage() {
  const { token } = useAuth();
  const router    = useRouter();

  const handleNovo = useCallback((payload: PayloadNovoComunicado) => {
    toast.info(`Novo informativo: ${payload.titulo}`, {
      action: {
        label: 'Ver',
        onClick: () => router.push(`/informativos/${payload.comunicadoId}`),
      },
    });
  }, [router]);

  const { items, isLoading, error } = useComunicadosCliente(token, handleNovo);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <Bell size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Informativos</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Avisos e comunicados do seu escritório</p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-500 text-center py-8">Erro ao carregar informativos.</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum informativo disponível</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ComunicadoCardCliente key={c.id} comunicado={c} />
          ))}
        </div>
      )}
    </div>
  );
}
