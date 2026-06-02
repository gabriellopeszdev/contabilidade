'use client';

import { useMemo, useCallback } from 'react';
import useSWR from 'swr';

// =============================================================================
// Tipos — Anti-Corruption Layer
// Espelham o contrato da API sem importar do domínio.
// =============================================================================

export type EstadoTarefa    = 'PENDING' | 'PROCESSING' | 'REVIEW' | 'DONE';
export type PrioridadeTarefa = 'LOW'    | 'MEDIUM'     | 'HIGH'   | 'URGENT';

export type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL';

export interface TarefaDTO {
  id:           string;
  clientId:     string;
  /** Retornado pela API via JOIN com usuario_cliente. */
  clienteNome:  string | null;
  assignedTo:   string | null;
  assignedToFuncionarioId:   string | null;
  assignedToFuncionarioNome: string | null;
  documentId:   string | null;
  /** Setor do documento associado (Fiscal, Pessoal, Contábil). */
  sector:       SetorTipo | null;
  title:        string;
  description:  string | null;
  currentState: EstadoTarefa;
  priority:     PrioridadeTarefa;
  /** ISO 8601 date string ou null. */
  dueDate:      string | null;
  completedAt:  string | null;
  position:     number;
  createdAt:    string;
  updatedAt:    string;
}

export interface TarefasAgrupadas {
  PENDING:    TarefaDTO[];
  PROCESSING: TarefaDTO[];
  REVIEW:     TarefaDTO[];
  DONE:       TarefaDTO[];
}

// =============================================================================
// Lógica de domínio replicada no frontend
//
// Por que duplicar? A Regra de Dependência proíbe o frontend de importar do
// domínio. Esta duplicação é intencional e documentada — é a Anti-Corruption
// Layer. Se as regras mudarem no backend, este arquivo também precisa mudar.
// =============================================================================

/**
 * Espelha TRANSICOES_VALIDAS de TarefaKanban.ts.
 * Fluxo principal: PENDING → PROCESSING → REVIEW → DONE
 * Retrabalho:      REVIEW  → PROCESSING
 * Reabertura:      PROCESSING → PENDING
 */
export const TRANSICOES_VALIDAS: Readonly<Record<EstadoTarefa, readonly EstadoTarefa[]>> = {
  PENDING:    ['PROCESSING'],
  PROCESSING: ['REVIEW', 'PENDING'],
  REVIEW:     ['DONE', 'PROCESSING'],
  DONE:       [],
} as const;

/** Verifica se a transição é permitida (espelha TarefaKanban.validarTransicao). */
export function podeTransitar(atual: EstadoTarefa, proximo: EstadoTarefa): boolean {
  return (TRANSICOES_VALIDAS[atual] as readonly string[]).includes(proximo);
}

/**
 * Computa se uma tarefa está atrasada (espelha TarefaKanban.estaAtrasada getter).
 * Recebe string ISO porque a API serializa Date → string.
 */
export function estaAtrasada(tarefa: TarefaDTO): boolean {
  if (!tarefa.dueDate || tarefa.currentState === 'DONE') return false;
  return Date.now() > new Date(tarefa.dueDate).getTime();
}

// =============================================================================
// SWR fetcher — autenticado com Bearer token
// =============================================================================

async function fetcher([url, token]: [string, string]): Promise<{ tarefas: TarefaDTO[] }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (res.status === 401) throw new Error('Sessão expirada. Faça login novamente.');
  if (!res.ok)            throw new Error(`Erro ao buscar tarefas (HTTP ${res.status})`);

  return res.json() as Promise<{ tarefas: TarefaDTO[] }>;
}

// =============================================================================
// Interface pública do hook
// =============================================================================

export interface UseKanbanReturn {
  tarefasAgrupadas: TarefasAgrupadas;
  todas:            TarefaDTO[];
  isLoading:        boolean;
  isError:          boolean;
  erroMsg:          string | null;
  /**
   * Move um card para outra coluna com Optimistic UI.
   *
   * Fluxo:
   *   1. Valida a transição client-side (podeTransitar)
   *   2. Atualiza o estado local imediatamente (sem loading visual)
   *   3. Envia PATCH /api/v1/kanban/:id/status em background
   *   4. Em caso de erro: reverte o estado local e chama onErro
   *   5. Em caso de sucesso: revalida (re-fetch silencioso para sync com servidor)
   */
  moverCard: (tarefaId: string, novoEstado: EstadoTarefa) => Promise<void>;
}

// =============================================================================
// useKanban
// =============================================================================

export function useKanban(
  token:      string | null | undefined,
  onErro?:    (mensagem: string) => void,
  clienteId?: string,
): UseKanbanReturn {

  // URL dinâmica: filtra por cliente se fornecido, senão retorna todas do contador
  const url = clienteId
    ? `/api/v1/kanban?clienteId=${encodeURIComponent(clienteId)}`
    : '/api/v1/kanban';

  // Chave null → SWR não faz fetch (aguarda token)
  const swrKey: [string, string] | null =
    token ? [url, token] : null;

  const { data, error, mutate, isLoading } = useSWR<{ tarefas: TarefaDTO[] }, Error>(
    swrKey,
    fetcher,
    {
      // Re-fetch ao ganhar foco (sincroniza aba ativa com servidor)
      revalidateOnFocus:        true,
      // Polling a cada 30s como fallback se WebSocket estiver offline
      refreshInterval:          30_000,
      // Mantém dados anteriores enquanto re-fetch acontece (sem flicker)
      keepPreviousData:         true,
      // Sem retry em erro de autenticação
      shouldRetryOnError:       (err: Error) => !err.message.includes('Sessão'),
    },
  );

  // -------------------------------------------------------------------------
  // Agrupa tarefas por coluna, ordenadas por position
  // -------------------------------------------------------------------------
  const todas = useMemo(() => data?.tarefas ?? [], [data]);

  const tarefasAgrupadas = useMemo<TarefasAgrupadas>(() => {
    const byState = (estado: EstadoTarefa) =>
      todas
        .filter((t) => t.currentState === estado)
        .sort((a, b) => a.position - b.position);

    return {
      PENDING:    byState('PENDING'),
      PROCESSING: byState('PROCESSING'),
      REVIEW:     byState('REVIEW'),
      DONE:       byState('DONE'),
    };
  }, [todas]);

  // -------------------------------------------------------------------------
  // moverCard — Optimistic UI com rollback automático
  // -------------------------------------------------------------------------
  const moverCard = useCallback(
    async (tarefaId: string, novoEstado: EstadoTarefa): Promise<void> => {
      if (!token || !data) return;

      const tarefa = data.tarefas.find((t) => t.id === tarefaId);
      if (!tarefa) return;

      // Validação client-side antes de qualquer I/O
      if (tarefa.currentState === novoEstado) return; // mesma coluna — noop
      if (!podeTransitar(tarefa.currentState, novoEstado)) {
        onErro?.(`Transição inválida: "${tarefa.currentState}" → "${novoEstado}".`);
        return;
      }

      // Snapshot para rollback
      const snapshot = data;

      // --- 1. Optimistic update (instantâneo, sem loading) ---
      await mutate(
        { tarefas: data.tarefas.map((t) =>
            t.id === tarefaId ? { ...t, currentState: novoEstado } : t,
          ),
        },
        { revalidate: false }, // não re-fetch ainda
      );

      // --- 2. PATCH em background ---
      try {
        const res = await fetch(`/api/v1/kanban/${tarefaId}/status`, {
          method:  'PATCH',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ novoEstado }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Erro HTTP ${res.status}`);
        }

        // --- 3. Re-fetch silencioso para sync com servidor ---
        await mutate();

      } catch (err) {
        // --- 4. Rollback silencioso ---
        await mutate(snapshot, { revalidate: false });
        onErro?.(err instanceof Error ? err.message : 'Erro ao mover card');
      }
    },
    [data, token, mutate, onErro],
  );

  return {
    tarefasAgrupadas,
    todas,
    isLoading,
    isError:  !!error,
    erroMsg:  error?.message ?? null,
    moverCard,
  };
}
