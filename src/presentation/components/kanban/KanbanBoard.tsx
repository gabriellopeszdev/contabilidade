'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  Clock,
  Zap,
  Eye,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Filter,
  X,
  type LucideIcon,
} from 'lucide-react';

import {
  useKanban,
  podeTransitar,
  type EstadoTarefa,
  type TarefaDTO,
  type SetorTipo,
  type FuncionarioSimples,
} from '../../hooks/useKanban';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard }   from './KanbanCard';

// =============================================================================
// Configuração das colunas
// =============================================================================

interface ColConfig {
  estado:    EstadoTarefa;
  label:     string;
  icone:     LucideIcon;
  corBorda:  string;
  corHeader: string;
}

const COLUNAS: ColConfig[] = [
  {
    estado:    'PENDING',
    label:     'Aguardando',
    icone:     Clock,
    corBorda:  'border-gray-200 dark:border-gray-700',
    corHeader: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  },
  {
    estado:    'PROCESSING',
    label:     'Em Execução',
    icone:     Zap,
    corBorda:  'border-primary/30 dark:border-primary/30',
    corHeader: 'bg-primary-light text-primary-dark dark:text-primary',
  },
  {
    estado:    'REVIEW',
    label:     'Em Revisão',
    icone:     Eye,
    corBorda:  'border-amber-200 dark:border-amber-800',
    corHeader: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300',
  },
  {
    estado:    'DONE',
    label:     'Concluído',
    icone:     CheckCircle2,
    corBorda:  'border-emerald-200 dark:border-emerald-800',
    corHeader: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300',
  },
];

// =============================================================================
// Constantes de filtro
// =============================================================================

const SETORES_FILTRO: { valor: SetorTipo; label: string; cor: string; corAtivo: string }[] = [
  { valor: 'FISCAL',   label: 'Fiscal',   cor: 'text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20', corAtivo: 'bg-indigo-600  text-white border-indigo-600' },
  { valor: 'PESSOAL',  label: 'Pessoal',  cor: 'text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-700 hover:bg-pink-50 dark:hover:bg-pink-900/20',           corAtivo: 'bg-pink-600    text-white border-pink-600'   },
  { valor: 'CONTABIL', label: 'Contábil', cor: 'text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20',           corAtivo: 'bg-teal-600    text-white border-teal-600'   },
];

// =============================================================================
// Props
// =============================================================================

interface KanbanBoardProps {
  token:     string | null | undefined;
  clienteId?: string;
  onErro?:  (mensagem: string) => void;
}

// =============================================================================
// KanbanBoard
// =============================================================================

async function equipeFetcher([url, tkn]: [string, string]): Promise<{ funcionarios: FuncionarioSimples[] }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tkn}` } });
  if (!res.ok) return { funcionarios: [] };
  return res.json() as Promise<{ funcionarios: FuncionarioSimples[] }>;
}

export function KanbanBoard({ token, clienteId, onErro }: KanbanBoardProps) {
  const { tarefasAgrupadas, todas, isLoading, isError, erroMsg, moverCard, atribuirResponsavel } =
    useKanban(token, onErro, clienteId);

  // Busca lista de funcionários para o popover de atribuição.
  // Retorna lista vazia para funcionários (403 na API) — atribuição fica oculta.
  const swrEquipeKey: [string, string] | null = token ? ['/api/v1/equipe', token] : null;
  const { data: equipeData } = useSWR(swrEquipeKey, equipeFetcher, { revalidateOnFocus: false });
  const funcionarios = equipeData?.funcionarios ?? [];

  // Filtros locais
  const [filtroSetor,        setFiltroSetor]        = useState<SetorTipo | null>(null);
  const [filtroCliente,      setFiltroCliente]      = useState<string>('');
  // '' = todos | '__sem__' = sem responsável | '<uuid>' = funcionário específico
  const [filtroFuncionario,  setFiltroFuncionario]  = useState<string>('');

  // Extrair lista única de clientes para o select
  const clientesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    todas.forEach((t) => {
      if (t.clientId && t.clienteNome) map.set(t.clientId, t.clienteNome);
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [todas]);

  // Extrair lista única de funcionários com tarefas atribuídas
  const funcionariosUnicos = useMemo(() => {
    const map = new Map<string, string>();
    todas.forEach((t) => {
      if (t.assignedToFuncionarioId && t.assignedToFuncionarioNome) {
        map.set(t.assignedToFuncionarioId, t.assignedToFuncionarioNome);
      }
    });
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [todas]);

  // Aplicar filtros sobre as tarefas agrupadas
  const tarefasFiltradas = useMemo(() => {
    const filtrar = (lista: TarefaDTO[]) =>
      lista.filter((t) => {
        if (filtroSetor && t.sector !== filtroSetor) return false;
        if (filtroCliente && t.clientId !== filtroCliente) return false;
        if (filtroFuncionario === '__sem__' && t.assignedToFuncionarioId !== null) return false;
        if (filtroFuncionario && filtroFuncionario !== '__sem__' && t.assignedToFuncionarioId !== filtroFuncionario) return false;
        return true;
      });

    return {
      PENDING:    filtrar(tarefasAgrupadas.PENDING),
      PROCESSING: filtrar(tarefasAgrupadas.PROCESSING),
      REVIEW:     filtrar(tarefasAgrupadas.REVIEW),
      DONE:       filtrar(tarefasAgrupadas.DONE),
    };
  }, [tarefasAgrupadas, filtroSetor, filtroCliente, filtroFuncionario]);

  const temFiltro = filtroSetor !== null || filtroCliente !== '' || filtroFuncionario !== '';
  const totalFiltrado = temFiltro
    ? tarefasFiltradas.PENDING.length + tarefasFiltradas.PROCESSING.length +
      tarefasFiltradas.REVIEW.length + tarefasFiltradas.DONE.length
    : todas.length;

  // ID do card sendo arrastado (para computar aceitaDrop e o DragOverlay)
  const [activeTarefaId, setActiveTarefaId] = useState<string | null>(null);

  const activeTarefa: TarefaDTO | null =
    activeTarefaId ? (todas.find((t) => t.id === activeTarefaId) ?? null) : null;

  // -------------------------------------------------------------------------
  // Sensors
  //
  // PointerSensor com activationConstraint.distance = 8px:
  //   Impede que um simples clique (sem arrastar) acione o drag.
  //   8px é o mínimo confortável para diferenciar clique de arraste.
  //
  // KeyboardSensor: acessibilidade — Tab para navegar, Space/Enter para
  //   pegar o card, setas para mover entre colunas, Space/Enter para soltar.
  // -------------------------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      // Usa o coordinateGetter do sortable para calcular posições via teclado
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // -------------------------------------------------------------------------
  // Handlers do ciclo de vida do drag
  // -------------------------------------------------------------------------

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTarefaId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTarefaId(null);

      // `over` é null se o card foi solto fora de qualquer droppable
      if (!over) return;

      const tarefaId   = active.id as string;
      const novoEstado = over.id  as EstadoTarefa;

      await moverCard(tarefaId, novoEstado);
    },
    [moverCard],
  );

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setActiveTarefaId(null);
    // O SWR não foi modificado durante o drag — nenhum rollback necessário
  }, []);

  // -------------------------------------------------------------------------
  // Computa quais colunas aceitam drop para o card sendo arrastado
  // -------------------------------------------------------------------------
  const aceitaDrop = useCallback(
    (targetEstado: EstadoTarefa): boolean => {
      if (!activeTarefa) return false;
      return podeTransitar(activeTarefa.currentState, targetEstado);
    },
    [activeTarefa],
  );

  // -------------------------------------------------------------------------
  // Estados de carregamento e erro
  // -------------------------------------------------------------------------

  if (isLoading && todas.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-500">
        <RefreshCw size={20} className="animate-spin" />
        <span className="text-sm font-medium">Carregando tarefas…</span>
      </div>
    );
  }

  if (isError && todas.length === 0) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-5 text-red-700"
      >
        <AlertCircle size={20} className="shrink-0" />
        <div>
          <p className="text-sm font-bold">Erro ao carregar o Kanban</p>
          <p className="text-xs mt-0.5 text-red-600">{erroMsg}</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render principal
  // -------------------------------------------------------------------------

  const hayArrastre = activeTarefaId !== null;

  return (
    <div>
      {/* ------------------------------------------------------------------ */}
      {/* Barra de Filtros                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter size={14} className="text-gray-400 shrink-0" />

        {/* Filtro por setor */}
        {SETORES_FILTRO.map((s) => (
          <button
            key={s.valor}
            type="button"
            onClick={() => setFiltroSetor((prev) => prev === s.valor ? null : s.valor)}
            className={`min-h-[44px] px-3 py-1 rounded-full text-[11px] font-bold border transition-all
                        ${filtroSetor === s.valor ? s.corAtivo : `bg-white dark:bg-gray-800 ${s.cor}`}`}
          >
            {s.label}
          </button>
        ))}

        {/* Separador visual */}
        {clientesUnicos.length > 0 && (
          <div className="w-px h-5 bg-gray-200 mx-1" />
        )}

        {/* Filtro por cliente */}
        {clientesUnicos.length > 0 && (
          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            aria-label="Filtrar por cliente"
            className="text-[11px] font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg
                       min-h-[44px] px-2.5 py-1 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary
                       max-w-[140px] sm:max-w-[180px] dark:[color-scheme:dark]"
          >
            <option value="">Todos os clientes</option>
            {clientesUnicos.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}

        {/* Filtro por funcionário responsável */}
        {funcionariosUnicos.length > 0 && (
          <select
            value={filtroFuncionario}
            onChange={(e) => setFiltroFuncionario(e.target.value)}
            aria-label="Filtrar por responsável"
            className="text-[11px] font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg
                       min-h-[44px] px-2.5 py-1 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400
                       max-w-[140px] sm:max-w-[180px] dark:[color-scheme:dark]"
          >
            <option value="">Toda a equipe</option>
            <option value="__sem__">Sem responsável</option>
            {funcionariosUnicos.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        )}

        {/* Badge de contagem + botão limpar */}
        {temFiltro && (
          <>
            <span className="text-[10px] text-gray-400 ml-1">
              {totalFiltrado} tarefa{totalFiltrado !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => { setFiltroSetor(null); setFiltroCliente(''); setFiltroFuncionario(''); }}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors ml-1"
            >
              <X size={12} />
              Limpar
            </button>
          </>
        )}
      </div>

    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      // Accessibility: anuncia o estado do drag para leitores de tela
      accessibility={{
        announcements: {
          onDragStart:  ({ active })       => `Movendo card: ${activeTarefa?.title ?? active.id}`,
          onDragOver:   ({ active, over })  =>
            over
              ? `Card ${activeTarefa?.title ?? active.id} sobre a coluna ${over.id}`
              : `Card ${activeTarefa?.title ?? active.id} fora das colunas`,
          onDragEnd:    ({ active, over })  =>
            over
              ? `Card ${activeTarefa?.title ?? active.id} movido para ${over.id}`
              : `Movimento cancelado`,
          onDragCancel: ({ active })        => `Movimento de ${activeTarefa?.title ?? active.id} cancelado`,
        },
        screenReaderInstructions: {
          draggable: 'Use Space ou Enter para pegar o card. Use as setas para mover entre colunas. Pressione Space ou Enter novamente para soltar, ou Escape para cancelar.',
        },
      }}
    >
      {/* Grid de colunas — scroll horizontal em mobile */}
      <div className="overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))' }}
      >
        {COLUNAS.map((col) => (
          <KanbanColumn
            key={col.estado}
            estado={col.estado}
            label={col.label}
            icone={col.icone}
            corBorda={col.corBorda}
            corHeader={col.corHeader}
            tarefas={tarefasFiltradas[col.estado]}
            aceitaDrop={aceitaDrop(col.estado)}
            hayArrastre={hayArrastre}
            funcionarios={funcionarios.length > 0 ? funcionarios : undefined}
            onAtribuirResponsavel={funcionarios.length > 0 ? atribuirResponsavel : undefined}
          />
        ))}
      </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DragOverlay — ghost card que segue o cursor durante o arraste       */}
      {/*                                                                     */}
      {/* Por que DragOverlay em vez de transform no card original?           */}
      {/* O card original fica no DOM (translúcido) como placeholder visual.  */}
      {/* O overlay é um clone desacoplado que segue o ponteiro, permitindo   */}
      {/* renderizar fora do scroll container e com estilos diferentes.       */}
      {/* ------------------------------------------------------------------ */}
      <DragOverlay
        dropAnimation={{
          duration:   200,
          easing:     'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeTarefa ? (
          <div className="w-full" style={{ maxWidth: '280px' }}>
            <KanbanCard tarefa={activeTarefa} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </div>
  );
}
