'use client';

import { useState, useCallback } from 'react';
import { ClipboardList, AlertCircle, X } from 'lucide-react';

import { useAuth }     from '../../../src/presentation/hooks/useAuth';
import { KanbanBoard } from '../../../src/presentation/components/kanban/KanbanBoard';

export default function KanbanPage() {
  const { token } = useAuth();
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const handleErro = useCallback((msg: string) => {
    setErroMsg(msg);
    setTimeout(() => setErroMsg(null), 5000);
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={20} className="text-violet-600 dark:text-violet-400" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Kanban</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Acompanhe e gerencie o fluxo de trabalho da equipe
        </p>
      </div>

      {erroMsg && (
        <div role="alert" className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{erroMsg}</span>
          <button onClick={() => setErroMsg(null)} aria-label="Fechar alerta" className="shrink-0 hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}

      <KanbanBoard token={token} onErro={handleErro} />
    </div>
  );
}
