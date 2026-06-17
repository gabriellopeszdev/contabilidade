'use client';

import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Building2,
  Clock,
  AlertTriangle,
  GripVertical,
  CheckCircle2,
  UserRound,
} from 'lucide-react';
import type { TarefaDTO, PrioridadeTarefa, SetorTipo, FuncionarioSimples } from '../../hooks/useKanban';
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
  MEDIUM: { label: 'Média',   classes: 'bg-primary-light text-primary-dark dark:text-primary border-primary/30 dark:border-primary/30'    },
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
  /** Lista de funcionários disponíveis para atribuição (apenas para o contador). */
  funcionarios?: FuncionarioSimples[];
  onAtribuirResponsavel?: (tarefaId: string, funcionarioId: string | null, funcionarioNome: string | null) => Promise<void>;
}

// =============================================================================
// KanbanCard
// =============================================================================

export function KanbanCard({ tarefa, isOverlay = false, funcionarios, onAtribuirResponsavel }: KanbanCardProps) {
  const isDone     = tarefa.currentState === 'DONE';
  const atrasada   = estaAtrasada(tarefa);
  const prioridade = PRIORIDADE_CONFIG[tarefa.priority];

  // Popover de atribuição de responsável
  const [popoverAberto, setPopoverAberto] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const canAssign = !isDone && !isOverlay && !!onAtribuirResponsavel && !!funcionarios && funcionarios.length > 0;

  useEffect(() => {
    if (!popoverAberto) return;
    const handler = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) setPopoverAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverAberto]);

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
          ? 'opacity-40 shadow-none border-dashed border-primary'
          : 'border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:shadow-md',
        // Overlay: sombra maior e leve rotação para sensação de "lift"
        isOverlay
          ? 'shadow-2xl border-primary rotate-1 cursor-grabbing'
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
                     focus-visible:ring-primary"
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
            {/* Avatar do funcionário responsável — clicável se canAssign */}
            <div className="relative" ref={popoverRef}>
              {canAssign ? (
                <button
                  type="button"
                  title={tarefa.assignedToFuncionarioNome ?? 'Atribuir responsável'}
                  onClick={() => setPopoverAberto((v) => !v)}
                  className={[
                    'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 border',
                    'transition-all hover:ring-2 hover:ring-offset-1 hover:ring-violet-300 dark:hover:ring-violet-600',
                    tarefa.assignedToFuncionarioNome
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800'
                      : 'bg-gray-100 dark:bg-gray-800 border-dashed border-gray-300 dark:border-gray-600',
                  ].join(' ')}
                >
                  {tarefa.assignedToFuncionarioNome
                    ? tarefa.assignedToFuncionarioNome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
                    : <UserRound size={10} className="text-gray-400" />
                  }
                </button>
              ) : tarefa.assignedToFuncionarioNome ? (
                <div
                  title={tarefa.assignedToFuncionarioNome}
                  className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400
                             flex items-center justify-center text-[9px] font-bold shrink-0 border border-violet-200 dark:border-violet-800"
                >
                  {tarefa.assignedToFuncionarioNome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')}
                </div>
              ) : (
                <div
                  title="Sem responsável"
                  className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600
                             flex items-center justify-center shrink-0"
                />
              )}

              {/* Popover de seleção */}
              {popoverAberto && canAssign && (
                <div className="absolute bottom-full right-0 mb-1.5 w-48 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 py-1 overflow-hidden">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                    Responsável
                  </p>
                  <button
                    type="button"
                    onClick={() => { onAtribuirResponsavel(tarefa.id, null, null); setPopoverAberto(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      tarefa.assignedToFuncionarioId === null
                        ? 'font-semibold text-gray-800 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-dashed border-gray-300 dark:border-gray-600 shrink-0" />
                    <span>Sem responsável</span>
                    {tarefa.assignedToFuncionarioId === null && (
                      <CheckCircle2 size={10} className="ml-auto text-emerald-500 shrink-0" />
                    )}
                  </button>
                  {funcionarios!.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { onAtribuirResponsavel(tarefa.id, f.id, f.name); setPopoverAberto(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        tarefa.assignedToFuncionarioId === f.id
                          ? 'font-semibold text-gray-800 dark:text-gray-100'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 flex items-center justify-center text-[8px] font-bold shrink-0">
                        {f.name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')}
                      </div>
                      <span className="truncate flex-1 text-left">{f.name}</span>
                      {tarefa.assignedToFuncionarioId === f.id && (
                        <CheckCircle2 size={10} className="ml-auto text-emerald-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
