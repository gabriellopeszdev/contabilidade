'use client';

import { useCallback } from 'react';
import { ClipboardList } from 'lucide-react';

import { useAuth }      from '../../../src/presentation/hooks/useAuth';
import { KanbanBoard }  from '../../../src/presentation/components/kanban/KanbanBoard';

export default function KanbanPage() {
  const { token } = useAuth();

  const handleErro = useCallback((_msg: string) => {}, []);

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

      <KanbanBoard token={token} onErro={handleErro} />
    </div>
  );
}
