'use client';

import { useDroppable } from '@dnd-kit/core';
import type { LucideIcon } from 'lucide-react';
import type { TarefaDTO, EstadoTarefa, FuncionarioSimples } from '../../hooks/useKanban';
import { KanbanCard } from './KanbanCard';

// =============================================================================
// Props
// =============================================================================

interface KanbanColumnProps {
  estado:       EstadoTarefa;
  label:        string;
  icone:        LucideIcon;
  /** Classes Tailwind para a cor da borda/header da coluna. */
  corBorda:     string;
  corHeader:    string;
  tarefas:      TarefaDTO[];
  /**
   * `true` quando a coluna é destino válido para o card sendo arrastado.
   * Calculado no KanbanBoard com base em podeTransitar().
   */
  aceitaDrop:   boolean;
  /** `true` quando há algum card sendo arrastado (mas não sobre esta coluna). */
  hayArrastre:  boolean;
  funcionarios?: FuncionarioSimples[];
  onAtribuirResponsavel?: (tarefaId: string, funcionarioId: string | null, funcionarioNome: string | null) => Promise<void>;
}

// =============================================================================
// KanbanColumn
// =============================================================================

export function KanbanColumn({
  estado,
  label,
  icone:   Icone,
  corBorda,
  corHeader,
  tarefas,
  aceitaDrop,
  hayArrastre,
  funcionarios,
  onAtribuirResponsavel,
}: KanbanColumnProps) {

  // useDroppable usa o estado da coluna como ID para que o onDragEnd
  // do Board saiba qual coluna recebeu o card.
  const { setNodeRef, isOver } = useDroppable({
    id:       estado,
    // disabled quando não é destino válido — previne drop indesejado
    disabled: !aceitaDrop,
  });

  // Visual feedback dinâmico durante o arraste
  const bgColumn = (() => {
    if (!hayArrastre)  return 'bg-gray-50 dark:bg-gray-800/40';
    if (!aceitaDrop)   return 'bg-gray-100 dark:bg-gray-800/20 opacity-60';
    if (isOver)        return 'bg-primary-50 dark:bg-primary/10 ring-2 ring-primary dark:ring-primary/50 ring-inset';
    return             'bg-gray-50 dark:bg-gray-800/40';
  })();

  const borderColumn = isOver && aceitaDrop
    ? `border-primary dark:border-primary ${corBorda}`
    : `border-gray-200 dark:border-gray-700 ${corBorda}`;

  return (
    <section
      aria-label={`Coluna ${label}`}
      className={`flex flex-col rounded-2xl border transition-all duration-150 overflow-hidden
                  snap-start min-w-[260px] w-[85vw] sm:w-auto sm:min-w-[240px]
                  min-h-[280px] sm:min-h-[480px] ${borderColumn}`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header da coluna                                                    */}
      {/* ------------------------------------------------------------------ */}
      <header className={`flex items-center justify-between px-4 py-3 ${corHeader}`}>
        <div className="flex items-center gap-2">
          <Icone size={15} className="shrink-0" />
          <h2 className="text-sm font-bold tracking-wide">{label}</h2>
        </div>

        {/* Contador de cards */}
        <span
          className="min-w-[22px] h-[22px] flex items-center justify-center
                     rounded-full bg-white/70 dark:bg-gray-900/70 text-xs font-bold tabular-nums"
          aria-label={`${tarefas.length} tarefas`}
        >
          {tarefas.length}
        </span>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Drop zone — ref obrigatório para o dnd-kit detectar o hover         */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={setNodeRef}
        role="list"
        aria-label={`Cards da coluna ${label}`}
        aria-dropeffect={aceitaDrop ? 'move' : 'none'}
        className={`flex-1 flex flex-col gap-2.5 p-3 transition-colors duration-150 ${bgColumn}`}
      >
        {tarefas.length === 0 ? (
          // Placeholder visual quando a coluna está vazia
          <div
            aria-hidden="true"
            className={`flex-1 flex items-center justify-center rounded-xl border-2 border-dashed
                        transition-colors duration-150 min-h-[80px]
                        ${isOver && aceitaDrop
                          ? 'border-primary dark:border-primary bg-primary-50/50 dark:bg-primary/10'
                          : 'border-gray-200 dark:border-gray-700 bg-transparent'
                        }`}
          >
            <p className="text-xs text-gray-400 font-medium select-none">
              {isOver && aceitaDrop ? 'Soltar aqui' : 'Nenhuma tarefa'}
            </p>
          </div>
        ) : (
          <>
            {tarefas.map((tarefa) => (
              <div key={tarefa.id} role="listitem">
                <KanbanCard
                  tarefa={tarefa}
                  funcionarios={funcionarios}
                  onAtribuirResponsavel={onAtribuirResponsavel}
                />
              </div>
            ))}

            {/* Drop target extra no final da lista (facilita drop após o último card) */}
            {aceitaDrop && (
              <div
                aria-hidden="true"
                className={`h-8 rounded-xl border-2 border-dashed transition-all duration-150
                            ${isOver
                              ? 'border-primary dark:border-primary bg-primary-50/50 dark:bg-primary/10'
                              : 'border-transparent'
                            }`}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
