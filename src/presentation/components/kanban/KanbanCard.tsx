'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Building2,
  Clock,
  AlertTriangle,
  GripVertical,
  CheckCircle2,
} from 'lucide-react';
import type { TarefaDTO, PrioridadeTarefa, SetorTipo } from '../../hooks/useKanban';
import { estaAtrasada } from '../../hooks/useKanban';

// =============================================================================
// Configuração visual por setor
// =============================================================================

const SETOR_CONFIG: Record<SetorTipo, { label: string; classes: string }> = {
  FISCAL:   { label: 'Fiscal',   classes: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'  },
  PESSOAL:  { label: 'Pessoal',  classes: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800'    },
  CONTABIL: { label: 'Contábil', classes: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800'    },
};

// =============================================================================
// Configuração visual por prioridade
// =============================================================================

const PRIORIDADE_CONFIG: Record<
  PrioridadeTarefa,
  { label: string; classes: string }
> = {
  LOW:    { label: 'Baixa',   classes: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'    },
  MEDIUM: { label: 'Média',   classes: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'    },
  HIGH:   { label: 'Alta',    classes: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
  URGENT: { label: 'Urgente', classes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'     },
};

// =============================================================================
// Props
// =============================================================================

interface KanbanCardProps {
  tarefa:     TarefaDTO;
  /**
   * Quando `true`, o card é renderizado como overlay do DragOverlay.
   * Nesse caso os handlers de drag são desabilitados para evitar recursão.
   */
  isOverlay?: boolean;
}

// =============================================================================
// KanbanCard
// =============================================================================

export function KanbanCard({ tarefa, isOverlay = false }: KanbanCardProps) {
  const isDone     = tarefa.currentState === 'DONE';
  const atrasada   = estaAtrasada(tarefa);
  const prioridade = PRIORIDADE_CONFIG[tarefa.priority];

  // -------------------------------------------------------------------------
  // useDraggable — desabilitado para DONE (terminal) e para o DragOverlay
  // -------------------------------------------------------------------------
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id:       tarefa.id,
    // data transportado para o DragOverlay e para o onDragEnd do Board
    data:     { tarefa },
    disabled: isOverlay || isDone,
  });

  // `transform` é null enquanto não está sendo arrastado.
  // No modo overlay, CSS.Translate seria aplicado duas vezes — evitamos isso.
  const style: React.CSSProperties | undefined =
    !isOverlay && transform
      ? { transform: CSS.Translate.toString(transform) }
      : undefined;

  const dueLabel = tarefa.dueDate
    ? new Date(tarefa.dueDate).toLocaleDateString('pt-BR', {
        day:   '2-digit',
        month: '2-digit',
      })
    : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <article
      ref={setNodeRef}
      style={style}
      aria-label={`Card: ${tarefa.title}`}
      aria-grabbed={isDragging}
      className={[
        'group relative bg-white dark:bg-gray-900 rounded-xl border shadow-sm',
        'transition-all duration-150 select-none',
        // Estado de arraste: o card original fica translúcido
        isDragging && !isOverlay
          ? 'opacity-40 shadow-none border-dashed border-blue-300'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md',
        // Overlay: sombra maior e leve rotação para sensação de "lift"
        isOverlay
          ? 'shadow-2xl border-blue-400 rotate-1 cursor-grabbing'
          : '',
        // DONE: visual muted, sem cursor de arraste
        isDone
          ? 'opacity-70 cursor-default'
          : !isOverlay
            ? 'cursor-grab active:cursor-grabbing'
            : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Grip handle — aparece no hover, área de arraste explícita */}
      {!isDone && !isOverlay && (
        <div
          {...listeners}
          {...attributes}
          role="button"
          aria-roledescription="Arraste para mover entre colunas"
          className="absolute left-0 inset-y-0 w-6 flex items-center justify-center
                     opacity-0 group-hover:opacity-100 transition-opacity
                     cursor-grab active:cursor-grabbing rounded-l-xl
                     hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:opacity-100
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset
                     focus-visible:ring-blue-400"
        >
          <GripVertical size={14} className="text-gray-400" />
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="px-4 py-3 pl-7">

        {/* Linha 1: Título + badge de prioridade */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className={`text-sm font-semibold leading-snug line-clamp-2 flex-1 ${
              isDone ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'
            }`}
          >
            {tarefa.title}
          </h3>

          <span
            className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md
                        text-[10px] font-bold uppercase tracking-wide border
                        ${prioridade.classes}`}
          >
            {prioridade.label}
          </span>
        </div>

        {/* Linha 2: Setor + Nome do cliente */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {tarefa.sector && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md
                          text-[10px] font-bold uppercase tracking-wide border
                          ${SETOR_CONFIG[tarefa.sector].classes}`}
            >
              {SETOR_CONFIG[tarefa.sector].label}
            </span>
          )}
          {tarefa.clienteNome && (
            <div className="flex items-center gap-1 min-w-0">
              <Building2 size={11} className="text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 truncate" title={tarefa.clienteNome}>
                {tarefa.clienteNome}
              </span>
            </div>
          )}
        </div>

        {/* Linha 3: Prazo + tags + responsável */}
        <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Data de vencimento */}
            {dueLabel && (
              <div
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  atrasada ? 'text-red-600' : 'text-gray-400'
                }`}
              >
                <Clock size={11} />
                <span>{dueLabel}</span>
              </div>
            )}

            {/* Tag "Atrasada" */}
            {atrasada && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md
                           bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold border border-red-200 dark:border-red-800"
                role="status"
                aria-label="Tarefa atrasada"
              >
                <AlertTriangle size={9} />
                Atrasada
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Avatar do funcionário responsável */}
            {tarefa.assignedToFuncionarioNome ? (
              <div
                title={tarefa.assignedToFuncionarioNome}
                className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400
                           flex items-center justify-center text-[9px] font-bold shrink-0 border border-violet-200 dark:border-violet-800"
              >
                {tarefa.assignedToFuncionarioNome
                  .split(' ').filter(Boolean).slice(0, 2)
                  .map((p) => p[0].toUpperCase()).join('')}
              </div>
            ) : (
              <div
                title="Sem responsável"
                className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600
                           flex items-center justify-center shrink-0"
              />
            )}

            {/* Ícone de concluída */}
            {isDone && (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
