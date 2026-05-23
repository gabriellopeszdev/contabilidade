'use client';

import { useEffect, useReducer, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

// =============================================================================
// Singleton — conexão Socket.IO vive no escopo do módulo para sobreviver a
// re-renders e ao Strict Mode do React (que remonta components em dev).
// =============================================================================

let socket: Socket | null = null;
let socketToken: string | null = null;   // token usado na conexão atual

// =============================================================================
// Tipos — espelham ServerToClientEvents do SocketServer.ts
// Definidos aqui para manter a Anti-Corruption Layer do frontend.
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

export type TipoNotificacao = 'novoDocumentoUpload' | 'documentoVisualizado' | 'chat_notification' | 'novoBoletoHonorario';

export interface Notificacao {
  id:        string;
  tipo:      TipoNotificacao;
  mensagem:  string;
  lida:      boolean;
  timestamp: Date;
  payload:   PayloadNovoUpload | PayloadDocumentoVisualizado | PayloadChatNotification | PayloadNovoBoleto;
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

    case 'NOVA_NOTIFICACAO':
      return {
        ...estado,
        // Mantém no máximo 50 notificaç��es (FIFO — descarta as mais antigas)
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
// Conecta ao servidor Socket.IO, autentica via JWT e gerencia o ciclo de vida
// da conexão usando o padrão SINGLETON no escopo do módulo.
//
// SINGLETON:
//   A instância do socket vive em `let socket` no módulo. O useEffect apenas
//   registra/remove listeners — nunca desconecta no cleanup. Isso impede que
//   o Strict Mode do React (que remonta em dev) mate a conexão WebSocket.
//
// TOKEN:
//   Passar `null` ou `undefined` desativa a conexão.
//   Se o token mudar, o socket antigo é descartado e um novo é criado.
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

  // Ref para acessar onNovaNotificacao sem re-criar o effect
  const callbackRef = useRef(onNovaNotificacao);
  callbackRef.current = onNovaNotificacao;

  useEffect(() => {
    // Sem token → não conecta (aguarda autenticação)
    if (!token) {
      despachar({ tipo: 'DESCONECTADO' });
      return;
    }

    // Se o token mudou (ex: refresh), descarta a conexão antiga para re-autenticar
    if (socket && socketToken !== token) {
      socket.disconnect();
      socket = null;
      socketToken = null;
    }

    // Singleton: só cria a conexão se ainda não existir
    if (!socket) {
      despachar({ tipo: 'CONECTANDO' });

      socketToken = token;
      socket = io(
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
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
      // Já conectado (remontagem React) — sincroniza estado do reducer
      despachar({ tipo: 'CONECTADO' });
    } else {
      despachar({ tipo: 'CONECTANDO' });
    }

    // Referência local para o cleanup (captura o socket do momento da montagem)
    const s = socket;

    // -------------------------------------------------------------------------
    // Eventos de conexão
    // -------------------------------------------------------------------------

    const onConnect = () => {
      despachar({ tipo: 'CONECTADO' });
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
    };

    // -------------------------------------------------------------------------
    // Eventos de domínio
    // -------------------------------------------------------------------------

    const onNovoUpload = (payload: PayloadNovoUpload) => {
      const notificacao: Notificacao = {
        id:        crypto.randomUUID(),
        tipo:      'novoDocumentoUpload',
        mensagem:  payload.mensagem,
        lida:      false,
        timestamp: new Date(),
        payload,
      };
      despachar({ tipo: 'NOVA_NOTIFICACAO', notificacao });
      callbackRef.current?.(notificacao);
    };

    const onDocVisualizado = (payload: PayloadDocumentoVisualizado) => {
      const notificacao: Notificacao = {
        id:        crypto.randomUUID(),
        tipo:      'documentoVisualizado',
        mensagem:  payload.mensagem || `"${payload.nomeArquivo}" foi visualizado`,
        lida:      false,
        timestamp: new Date(),
        payload,
      };
      despachar({ tipo: 'NOVA_NOTIFICACAO', notificacao });
      callbackRef.current?.(notificacao);
    };

    s.on('connect',        onConnect);
    s.on('disconnect',     onDisconnect);
    s.on('connect_error',  onConnectError);
    const onChatNotification = (payload: PayloadChatNotification) => {
      const notificacao: Notificacao = {
        id:        crypto.randomUUID(),
        tipo:      'chat_notification',
        mensagem:  `${payload.senderNome}: ${payload.preview}`,
        lida:      false,
        timestamp: new Date(),
        payload,
      };
      despachar({ tipo: 'NOVA_NOTIFICACAO', notificacao });
      callbackRef.current?.(notificacao);
    };

    s.on('novoDocumentoUpload',    onNovoUpload);
    s.on('documentoVisualizado',   onDocVisualizado);
    s.on('chat_notification',      onChatNotification);

    const onNovoBoleto = (payload: PayloadNovoBoleto) => {
      const notificacao: Notificacao = {
        id:        crypto.randomUUID(),
        tipo:      'novoBoletoHonorario',
        mensagem:  payload.mensagem || `Novo boleto de honorários disponível (${payload.mesReferencia}).`,
        lida:      false,
        timestamp: new Date(),
        payload,
      };
      despachar({ tipo: 'NOVA_NOTIFICACAO', notificacao });
      callbackRef.current?.(notificacao);
    };

    s.on('novoBoletoHonorario',    onNovoBoleto);
    s.io.on('reconnect_attempt',   onReconnectAttempt);
    s.io.on('reconnect',           onReconnect);

    // -------------------------------------------------------------------------
    // Cleanup: remove APENAS os listeners deste componente.
    // NÃO desconecta o socket — ele é singleton e deve sobreviver a re-renders.
    // -------------------------------------------------------------------------
    return () => {
      s.off('connect',        onConnect);
      s.off('disconnect',     onDisconnect);
      s.off('connect_error',  onConnectError);
      s.off('novoDocumentoUpload',    onNovoUpload);
      s.off('documentoVisualizado',   onDocVisualizado);
      s.off('chat_notification',      onChatNotification);
      s.off('novoBoletoHonorario',    onNovoBoleto);
      s.io.off('reconnect_attempt',   onReconnectAttempt);
      s.io.off('reconnect',           onReconnect);
    };
  }, [token]); // Re-executa apenas quando o token muda

  const marcarComoLida = useCallback(
    (id: string) => despachar({ tipo: 'MARCAR_LIDA', id }),
    [],
  );

  const marcarTodasLidas = useCallback(
    () => despachar({ tipo: 'MARCAR_TODAS_LIDAS' }),
    [],
  );

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
    marcarComoLida,
    marcarTodasLidas,
    remover,
    limpar,
  };
}
