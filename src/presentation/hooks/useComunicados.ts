'use client';

import { useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { getSocket } from './useNotificacoes';

// =============================================================================
// Tipos
// =============================================================================

export interface ComunicadoResumoContador {
  id:                 string;
  titulo:             string;
  targeting:          string;
  setor:              string | null;
  exigeConfirmacao:   boolean;
  publicadoAt:        string;
  totalDestinatarios: number;
  totalLidos:         number;
  totalConfirmados:   number;
}

export interface ComunicadoResumoCliente {
  id:               string;
  titulo:           string;
  conteudo:         string;
  exigeConfirmacao: boolean;
  publicadoAt:      string;
  souDestinatario:  boolean;
  lido:             boolean;
  confirmado:       boolean;
}

export interface PayloadNovoComunicado {
  comunicadoId: string;
  titulo:       string;
  contadorNome: string;
}

// =============================================================================
// Fetcher SWR
// =============================================================================

function fetcherComToken(token: string) {
  return async (url: string) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<unknown>;
  };
}

// =============================================================================
// useComunicadosContador — listagem para o CONTADOR
// =============================================================================

export function useComunicadosContador(token: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    token ? ['/api/v1/comunicados', token] : null,
    ([url, t]: [string, string]) => fetcherComToken(t)(url),
    { revalidateOnFocus: false },
  );

  return {
    items:     ((data as { items?: ComunicadoResumoContador[] } | undefined)?.items) ?? [],
    total:     ((data as { total?: number } | undefined)?.total) ?? 0,
    isLoading,
    error,
    revalidar: mutate,
  };
}

// =============================================================================
// useComunicadosCliente — listagem para o CLIENTE + listener novo_comunicado
// =============================================================================

export function useComunicadosCliente(
  token: string | null | undefined,
  onNovoComunicado?: (payload: PayloadNovoComunicado) => void,
) {
  const { data, error, isLoading, mutate } = useSWR(
    token ? ['/api/v1/comunicados', token] : null,
    ([url, t]: [string, string]) => fetcherComToken(t)(url),
    { revalidateOnFocus: false },
  );

  const callbackStable = useCallback(
    (payload: PayloadNovoComunicado) => onNovoComunicado?.(payload),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (payload: PayloadNovoComunicado) => {
      void mutate();
      callbackStable(payload);
    };

    socket.on('novo_comunicado', handler);
    return () => { socket.off('novo_comunicado', handler); };
  }, [mutate, callbackStable]);

  return {
    items:     ((data as { items?: ComunicadoResumoCliente[] } | undefined)?.items) ?? [],
    total:     ((data as { total?: number } | undefined)?.total) ?? 0,
    isLoading,
    error,
    revalidar: mutate,
  };
}
