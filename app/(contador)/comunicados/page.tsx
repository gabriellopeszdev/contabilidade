'use client';

import { useState, useCallback } from 'react';
import { Plus, Megaphone, Loader2 } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { useComunicadosContador } from '../../../src/presentation/hooks/useComunicados';
import { ComunicadoCardContador } from '../../../src/presentation/components/comunicados/ComunicadoCard';
import { NovoComunicadoModal } from '../../../src/presentation/components/comunicados/NovoComunicadoModal';

export default function ComunicadosPage() {
  const { token } = useAuth();
  const { items, isLoading, error, revalidar } = useComunicadosContador(token);
  const [modalAberto, setModalAberto] = useState(false);

  const handleSucesso = useCallback(() => {
    void revalidar();
  }, [revalidar]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <Megaphone size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Comunicados</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avisos publicados para seus clientes</p>
          </div>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors shadow-sm"
        >
          <Plus size={16} /> Novo Comunicado
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-500 text-center py-8">Erro ao carregar comunicados.</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum comunicado publicado</p>
          <p className="text-xs mt-1">Clique em &quot;Novo Comunicado&quot; para criar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ComunicadoCardContador key={c.id} comunicado={c} />
          ))}
        </div>
      )}

      {token && (
        <NovoComunicadoModal
          aberto={modalAberto}
          token={token}
          onFechar={() => setModalAberto(false)}
          onSucesso={handleSucesso}
        />
      )}
    </div>
  );
}
