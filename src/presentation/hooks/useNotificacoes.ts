'use client';

import { useEffect, useReducer, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

// =============================================================================
// Singleton — conexão Socket.IO vive no escopo do módulo para sobreviver a
// re-renders e ao Strict Mode do React.
// =============================================================================

let socket: Socket | null = null;
let socketToken: string | null = null;

// =============================================================================
// Tipos
// =============================================================================

export interface PayloadNovoUpload {
  loteId:          string;
  clienteId:       string;
  totalUploadados: number;
  totalFalhas:     number;
  mensagem:        string;
}

export interface PayloadDocumentoVisualizado {
  documentoId: string;
  clienteId:   string;
  nomeArquivo: string;
  sector:      string;
  mensagem:    string;
}

export interface PayloadChatNotification {
  roomId:     string;
  senderNome: string;
  preview:    string;
}

export interface PayloadNovoBoleto {
  boletoId:      string;
  clienteId:     string;
  mesReferencia: string;
  valor:         number;
  vencimento:    string;
  mensagem:      string;
}

// Tipo unificado — usado tanto para eventos DB quanto in-memory (chat)
export interface Notificacao {
  id:        string;
  tipo:      string;
  titulo:    string;
  mensagem:  string;
  lida:      boolean;
  createdAt: Date;
  /** Presente apenas em notificações vindas de eventos WS legados */
  payload?:  PayloadNovoUpload | PayloadDocumentoVisualizado | PayloadChatNotification | PayloadNovoBoleto;
}

export type StatusConexao =
  | 'desconectado'
  | 'conectando'
  | 'conectado'
  | 'reconectando'
  | 'erro_auth';

// =============================================================================
// Estado e Reducer
// =============================================================================

interface Estado {
  status:        StatusConexao;
  notificacoes:  Notificacao[];
  erroConexao:   string | null;
}

type Acao =
  | { tipo: 'CONECTANDO' }
  | { tipo: 'CONECTADO' }
  | { tipo: 'RECONECTANDO';   tentativa: number }
  | { tipo: 'ERRO_AUTH' }
  | { tipo: 'DESCONECTADO' }
  | { tipo: 'CARREGAR_INICIAL'; notificacoes: Notificacao[] }
  | { tipo: 'NOVA_NOTIFICACAO'; notificacao: Notificacao }
  | { tipo: 'MARCAR_LIDA';     id: string }
  | { tipo: 'MARCAR_TODAS_LIDAS' }
  | { tipo: 'REMOVER';         id: string }
  | { tipo: 'LIMPAR' };

function reducer(estado: Estado, acao: Acao): Estado {
  switch (acao.tipo) {
    case 'CONECTANDO':
      return { ...estado, status: 'conectando', erroConexao: null };
    case 'CONECTADO':
      return { ...estado, status: 'conectado', erroConexao: null };
    case 'RECONECTANDO':
      return { ...estado, status: 'reconectando' };
    case 'ERRO_AUTH':
      return { ...estado, status: 'erro_auth', erroConexao: 'Sessão expirada. Recarregue a página.' };
    case 'DESCONECTADO':
      return { ...estado, status: 'desconectado' };

    case 'CARREGAR_INICIAL':
      return { ...estado, notificacoes: acao.notificacoes };

    case 'NOVA_NOTIFICACAO':
      return {
        ...estado,
        notificacoes: [acao.notificacao, ...estado.notificacoes].slice(0, 50),
      };

    case 'MARCAR_LIDA':
      return {
        ...estado,
        notificacoes: estado.notificacoes.map((n) =>
          n.id === acao.id ? { ...n, lida: true } : n,
        ),
      };

    case 'MARCAR_TODAS_LIDAS':
      return {
        ...estado,
        notificacoes: estado.notificacoes.map((n) => ({ ...n, lida: true })),
      };

    case 'REMOVER':
      return {
        ...estado,
        notificacoes: estado.notificacoes.filter((n) => n.id !== acao.id),
      };

    case 'LIMPAR':
      return { ...estado, notificacoes: [] };

    default:
      return estado;
  }
}

// =============================================================================
// Interface pública do hook
// =============================================================================

export interface UseNotificacoesReturn {
  status:           StatusConexao;
  notificacoes:     Notificacao[];
  naoLidas:         number;
  erroConexao:      string | null;
  marcarComoLida:   (id: string) => void;
  marcarTodasLidas: () => void;
  remover:          (id: string) => void;
  limpar:           () => void;
}

// =============================================================================
// useNotificacoes
//
// Combina Socket.IO (tempo-real) + REST API (persistência):
//   • Ao conectar: busca as últimas 50 notificações da API
//   • nova_notificacao WS: adiciona ao topo (DB-backed, id real)
//   • chat_notification WS: notificação in-memory (não persiste)
//   • marcarComoLida / marcarTodasLidas: chamam a API + atualizam estado local
// =============================================================================

export function useNotificacoes(
  token: string | null | undefined,
  onNovaNotificacao?: (n: Notificacao) => void,
): UseNotificacoesReturn {

  const [estado, despachar] = useReducer(reducer, {
    status:       'desconectado',
    notificacoes: [],
    erroConexao:  null,
  });

  const callbackRef = useRef(onNovaNotificacao);
  callbackRef.current = onNovaNotificacao;

  const tokenRef = useRef(token);
  tokenRef.current = token;

  // ---------------------------------------------------------------------------
  // Busca inicial da API (executa após conectar)
  // ---------------------------------------------------------------------------
  const carregarDaApi = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await fetch('/api/v1/notificacoes', {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) return;
      const data = await res.json() as {
        items: { id: string; tipo: string; titulo: string; mensagem: string; lida: boolean; createdAt: string }[];
      };
      const notificacoes: Notificacao[] = data.items.map((item) => ({
        id:        item.id,
        tipo:      item.tipo,
        titulo:    item.titulo,
        mensagem:  item.mensagem,
        lida:      item.lida,
        createdAt: new Date(item.createdAt),
      }));
      despachar({ tipo: 'CARREGAR_INICIAL', notificacoes });
    } catch {
      // fail-open — WS ainda funciona sem persistência
    }
  }, []);

  useEffect(() => {
    if (!token) {
      despachar({ tipo: 'DESCONECTADO' });
      return;
    }

    if (socket && socketToken !== token) {
      socket.disconnect();
      socket = null;
      socketToken = null;
    }

    if (!socket) {
      despachar({ tipo: 'CONECTANDO' });
      socketToken = token;
      socket = io(
        process.env.NEXT_PUBLIC_APP_URL || window.location.origin,
        {
          path:             '/api/ws',
          addTrailingSlash: false,
          auth:             { token },
          transports:       ['websocket'],
          reconnection:         true,
          reconnectionAttempts: 10,
          reconnectionDelay:    1_000,
          reconnectionDelayMax: 10_000,
          timeout:              10_000,
        },
      );
    } else if (socket.connected) {
      despachar({ tipo: 'CONECTADO' });
      void carregarDaApi();
    } else {
      despachar({ tipo: 'CONECTANDO' });
    }

    const s = socket;

    // -------------------------------------------------------------------------
    // Eventos de conexão
    // -------------------------------------------------------------------------

    const onConnect = () => {
      despachar({ tipo: 'CONECTADO' });
      void carregarDaApi();
    };

    const onDisconnect = (reason: string) => {
      if (reason === 'io server disconnect') {
        despachar({ tipo: 'DESCONECTADO' });
      }
    };

    const onConnectError = (err: Error) => {
      if (err.message.includes('WS_UNAUTHORIZED')) {
        despachar({ tipo: 'ERRO_AUTH' });
        s.disconnect();
        socket = null;
        socketToken = null;
      }
    };

    const onReconnectAttempt = (tentativa: number) => {
      despachar({ tipo: 'RECONECTANDO', tentativa });
    };

    const onReconnect = () => {
      despachar({ tipo: 'CONECTADO' });
      void carregarDaApi();
    };

    // -------------------------------------------------------------------------
    // nova_notificacao — evento DB-backed (id real, persiste)
    // -------------------------------------------------------------------------

    const onNovaNotificacaoDB = (payload: {
      id: string; tipo: string; titulo: string; mensagem: string; createdAt: string;
    }) => {
      const notificacao: Notificacao = {
        id:        payload.id,
        tipo:      payload.tipo,
        titulo:    payload.titulo,
        mensagem:  payload.mensagem,
        lida:      false,
        createdAt: new Date(payload.createdAt),
      };
      despachar({ tipo: 'NOVA_NOTIFICACAO', notificacao });
      callbackRef.current?.(notificacao);
    };

    // -------------------------------------------------------------------------
    // chat_notification — in-memory (não persiste no DB)
    // -------------------------------------------------------------------------

    const onChatNotification = (payload: PayloadChatNotification) => {
      const notificacao: Notificacao = {
        id:        crypto.randomUUID(),
        tipo:      'CHAT',
        titulo:    'Nova mensagem no chat',
        mensagem:  `${payload.senderNome}: ${payload.preview}`,
        lida:      false,
        createdAt: new Date(),
        payload,
      };
      despachar({ tipo: 'NOVA_NOTIFICACAO', notificacao });
      callbackRef.current?.(notificacao);
    };

    s.on('connect',           onConnect);
    s.on('disconnect',        onDisconnect);
    s.on('connect_error',     onConnectError);
    s.on('nova_notificacao',  onNovaNotificacaoDB);
    s.on('chat_notification', onChatNotification);
    s.io.on('reconnect_attempt', onReconnectAttempt);
    s.io.on('reconnect',         onReconnect);

    return () => {
      s.off('connect',           onConnect);
      s.off('disconnect',        onDisconnect);
      s.off('connect_error',     onConnectError);
      s.off('nova_notificacao',  onNovaNotificacaoDB);
      s.off('chat_notification', onChatNotification);
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.io.off('reconnect',         onReconnect);
    };
  }, [token, carregarDaApi]);

  // ---------------------------------------------------------------------------
  // Marcar como lida — chama API + atualiza estado local
  // ---------------------------------------------------------------------------

  const marcarComoLida = useCallback(async (id: string) => {
    despachar({ tipo: 'MARCAR_LIDA', id });
    // notificações in-memory (chat) não têm entrada no DB
    const notif = estado.notificacoes.find((n) => n.id === id);
    if (!notif || notif.tipo === 'CHAT') return;
    try {
      await fetch(`/api/v1/notificacoes/${id}/lida`, {
        method:  'PATCH',
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
      });
    } catch { /* fail-open */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.notificacoes]);

  const marcarTodasLidas = useCallback(async () => {
    despachar({ tipo: 'MARCAR_TODAS_LIDAS' });
    try {
      await fetch('/api/v1/notificacoes/todas-lidas', {
        method:  'PATCH',
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
      });
    } catch { /* fail-open */ }
  }, []);

  const remover = useCallback(
    (id: string) => despachar({ tipo: 'REMOVER', id }),
    [],
  );

  const limpar = useCallback(() => despachar({ tipo: 'LIMPAR' }), []);

  return {
    status:           estado.status,
    notificacoes:     estado.notificacoes,
    naoLidas:         estado.notificacoes.filter((n) => !n.lida).length,
    erroConexao:      estado.erroConexao,
    marcarComoLida:   (id) => void marcarComoLida(id),
    marcarTodasLidas: () => void marcarTodasLidas(),
    remover,
    limpar,
  };
}
