'use client';

import { useEffect, useReducer, useCallback, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

// =============================================================================
// Singleton — compartilhada com useNotificacoes (mesmo path /api/ws)
// Em produção, reutilizar a mesma instância evita conexões duplicadas.
// Porém, o singleton principal vive em useNotificacoes.
// Aqui usamos a mesma referência do módulo socket.io-client que gerencia
// internamente multiplexação por URL+path.
// =============================================================================

// =============================================================================
// Tipos
// =============================================================================

export interface ChatMensagem {
  id:         string;
  roomId:     string;
  senderId:   string;
  senderType: string;
  senderNome: string;
  content:    string;
  documentId: string | null;
  createdAt:  string;
}

export interface ChatRoom {
  id:              string;
  clienteId:       string;
  clienteNome:     string;
  clienteCnpj:     string;
  clienteAvatar:   string | null;
  // Campos presentes na visão do cliente (sala por membro)
  membroId?:       string;
  membroNome?:     string;
  membroTipo?:     'CONTADOR' | 'FUNCIONARIO';
  membroSetores?:  string[];
  membroAvatar?:   string | null;
  ultimaMensagem:  { content: string; createdAt: string; senderType: string } | null;
  naoLidas:        number;
  createdAt:       string;
}

export interface TypingInfo {
  roomId:   string;
  userId:   string;
  nome:     string;
  isTyping: boolean;
}

// =============================================================================
// Estado e Reducer
// =============================================================================

interface Estado {
  rooms:          ChatRoom[];
  mensagens:      ChatMensagem[];
  carregandoRooms:     boolean;
  carregandoMensagens: boolean;
  nextCursor:     string | null;
  hasMore:        boolean;
  typing:         TypingInfo | null;
}

type Acao =
  | { tipo: 'SET_ROOMS';            rooms: ChatRoom[] }
  | { tipo: 'CARREGANDO_ROOMS';     v: boolean }
  | { tipo: 'SET_MENSAGENS';        mensagens: ChatMensagem[]; nextCursor: string | null; hasMore: boolean }
  | { tipo: 'PREPEND_MENSAGENS';    mensagens: ChatMensagem[]; nextCursor: string | null; hasMore: boolean }
  | { tipo: 'CARREGANDO_MENSAGENS'; v: boolean }
  | { tipo: 'NOVA_MENSAGEM';        mensagem: ChatMensagem }
  | { tipo: 'SET_TYPING';           info: TypingInfo | null }
  | { tipo: 'ATUALIZAR_NAO_LIDAS';  roomId: string; naoLidas: number }
  | { tipo: 'ATUALIZAR_ULTIMA_MSG'; roomId: string; msg: { content: string; createdAt: string; senderType: string } };

function reducer(estado: Estado, acao: Acao): Estado {
  switch (acao.tipo) {
    case 'SET_ROOMS':
      return { ...estado, rooms: acao.rooms, carregandoRooms: false };
    case 'CARREGANDO_ROOMS':
      return { ...estado, carregandoRooms: acao.v };
    case 'SET_MENSAGENS':
      return { ...estado, mensagens: acao.mensagens, nextCursor: acao.nextCursor, hasMore: acao.hasMore, carregandoMensagens: false };
    case 'PREPEND_MENSAGENS':
      return { ...estado, mensagens: [...acao.mensagens, ...estado.mensagens], nextCursor: acao.nextCursor, hasMore: acao.hasMore, carregandoMensagens: false };
    case 'CARREGANDO_MENSAGENS':
      return { ...estado, carregandoMensagens: acao.v };
    case 'NOVA_MENSAGEM': {
      // Dedup: evita duplicatas se o mesmo evento socket chegar 2x (reconexão)
      const jáExiste = estado.mensagens.some((m) => m.id === acao.mensagem.id);
      if (jáExiste) return estado;
      return {
        ...estado,
        mensagens: [...estado.mensagens, acao.mensagem],
      };
    }
    case 'SET_TYPING':
      return { ...estado, typing: acao.info };
    case 'ATUALIZAR_NAO_LIDAS':
      return {
        ...estado,
        rooms: estado.rooms.map((r) =>
          r.id === acao.roomId ? { ...r, naoLidas: acao.naoLidas } : r,
        ),
      };
    case 'ATUALIZAR_ULTIMA_MSG':
      return {
        ...estado,
        rooms: estado.rooms.map((r) =>
          r.id === acao.roomId
            ? { ...r, ultimaMensagem: acao.msg, naoLidas: 0 }
            : r,
        ),
      };
    default:
      return estado;
  }
}

const estadoInicial: Estado = {
  rooms:               [],
  mensagens:           [],
  carregandoRooms:     false,
  carregandoMensagens: false,
  nextCursor:          null,
  hasMore:             false,
  typing:              null,
};

// =============================================================================
// useChat
// =============================================================================

export interface UseChatReturn {
  rooms:               ChatRoom[];
  mensagens:           ChatMensagem[];
  carregandoRooms:     boolean;
  carregandoMensagens: boolean;
  hasMore:             boolean;
  typing:              TypingInfo | null;
  roomAtual:           string | null;
  carregarRooms:       () => Promise<void>;
  selecionarRoom:      (roomId: string) => Promise<void>;
  enviarMensagem:      (content: string, documentId?: string) => Promise<boolean>;
  carregarMaisAntigas: () => Promise<void>;
  emitirTyping:        (isTyping: boolean) => void;
  totalNaoLidas:       number;
}

export function useChat(token: string | null | undefined): UseChatReturn {
  const [estado, despachar] = useReducer(reducer, estadoInicial);
  const [roomAtual, setRoomAtual] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // Socket connection (reutiliza o mesmo path /api/ws)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!token) return;

    const s = io(process.env.NEXT_PUBLIC_APP_URL || window.location.origin, {
      path:             '/api/ws',
      addTrailingSlash: false,
      auth:             { token },
      transports:       ['websocket'],
      // Multiplexação: socket.io-client reutiliza a conexão se mesmo URL+path
      multiplex:        true,
    });

    socketRef.current = s;

    // Listeners de chat
    const onChatMessage = (msg: ChatMensagem) => {
      despachar({ tipo: 'NOVA_MENSAGEM', mensagem: msg });
      // Atualiza última mensagem na lista de rooms
      despachar({
        tipo: 'ATUALIZAR_ULTIMA_MSG',
        roomId: msg.roomId,
        msg: { content: msg.content, createdAt: msg.createdAt, senderType: msg.senderType },
      });
    };

    const onChatTyping = (info: TypingInfo) => {
      despachar({ tipo: 'SET_TYPING', info: info.isTyping ? info : null });
      // Auto-clear typing after 3s
      if (info.isTyping) {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          despachar({ tipo: 'SET_TYPING', info: null });
        }, 3000);
      }
    };

    s.on('chat_message', onChatMessage);
    s.on('chat_typing',  onChatTyping);

    return () => {
      s.off('chat_message', onChatMessage);
      s.off('chat_typing',  onChatTyping);
      // Não desconecta — o singleton de useNotificacoes gerencia o ciclo de vida
    };
  }, [token]);

  // -----------------------------------------------------------------------
  // API helpers
  // -----------------------------------------------------------------------
  const authHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [token]);

  // -----------------------------------------------------------------------
  // Carregar rooms
  // -----------------------------------------------------------------------
  const carregarRooms = useCallback(async () => {
    despachar({ tipo: 'CARREGANDO_ROOMS', v: true });
    try {
      const res = await fetch('/api/v1/chat/rooms', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao carregar salas');
      const data = await res.json();
      despachar({ tipo: 'SET_ROOMS', rooms: data.rooms });
    } catch {
      despachar({ tipo: 'CARREGANDO_ROOMS', v: false });
    }
  }, [authHeaders]);

  // -----------------------------------------------------------------------
  // Selecionar room (carrega mensagens + join socket room)
  // -----------------------------------------------------------------------
  const selecionarRoom = useCallback(async (roomId: string) => {
    // Leave room anterior
    if (roomAtual && socketRef.current) {
      socketRef.current.emit('leave_room', roomAtual);
    }

    setRoomAtual(roomId);
    despachar({ tipo: 'CARREGANDO_MENSAGENS', v: true });

    // Join nova room
    if (socketRef.current) {
      socketRef.current.emit('join_room', roomId);
    }

    try {
      const res = await fetch(`/api/v1/chat/rooms/${roomId}?limit=30`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Erro ao carregar mensagens');
      const data = await res.json();
      despachar({
        tipo: 'SET_MENSAGENS',
        mensagens:  data.messages, // API já retorna em ordem cronológica (ASC)
        nextCursor: data.nextCursor,
        hasMore:    data.hasMore,
      });

      // Mark as read
      await fetch(`/api/v1/chat/rooms/${roomId}`, {
        method:  'PATCH',
        headers: authHeaders(),
      });

      // Atualiza badge
      despachar({ tipo: 'ATUALIZAR_NAO_LIDAS', roomId, naoLidas: 0 });
    } catch {
      despachar({ tipo: 'CARREGANDO_MENSAGENS', v: false });
    }
  }, [roomAtual, authHeaders]);

  // -----------------------------------------------------------------------
  // Carregar mensagens mais antigas (scroll up)
  // -----------------------------------------------------------------------
  const carregarMaisAntigas = useCallback(async () => {
    if (!roomAtual || !estado.nextCursor || estado.carregandoMensagens) return;

    despachar({ tipo: 'CARREGANDO_MENSAGENS', v: true });
    try {
      const res = await fetch(
        `/api/v1/chat/rooms/${roomAtual}?limit=30&cursor=${estado.nextCursor}`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error('Erro ao carregar mensagens');
      const data = await res.json();
      despachar({
        tipo: 'PREPEND_MENSAGENS',
        mensagens:  data.messages, // API já retorna em ordem cronológica (ASC)
        nextCursor: data.nextCursor,
        hasMore:    data.hasMore,
      });
    } catch {
      despachar({ tipo: 'CARREGANDO_MENSAGENS', v: false });
    }
  }, [roomAtual, estado.nextCursor, estado.carregandoMensagens, authHeaders]);

  // -----------------------------------------------------------------------
  // Enviar mensagem via Socket.IO (com fallback HTTP)
  // -----------------------------------------------------------------------
  const enviarMensagem = useCallback(async (content: string, documentId?: string): Promise<boolean> => {
    if (!roomAtual || (!content.trim() && !documentId)) return false;

    // Tenta via socket primeiro (mais rápido)
    if (socketRef.current?.connected) {
      return new Promise((resolve) => {
        socketRef.current!.emit(
          'send_message',
          { roomId: roomAtual, content: content.trim(), documentId },
          (resp: { ok: boolean }) => {
            resolve(resp.ok);
          },
        );
      });
    }

    // Fallback HTTP
    try {
      const res = await fetch(`/api/v1/chat/rooms/${roomAtual}`, {
        method:  'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: content.trim(), documentId }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      despachar({ tipo: 'NOVA_MENSAGEM', mensagem: data.message });
      return true;
    } catch {
      return false;
    }
  }, [roomAtual, authHeaders]);

  // -----------------------------------------------------------------------
  // Typing indicator
  // -----------------------------------------------------------------------
  const emitirTyping = useCallback((isTyping: boolean) => {
    if (!roomAtual || !socketRef.current?.connected) return;
    socketRef.current.emit('typing_status', { roomId: roomAtual, isTyping });
  }, [roomAtual]);

  // Total não lidas
  const totalNaoLidas = estado.rooms.reduce((acc, r) => acc + r.naoLidas, 0);

  return {
    rooms:               estado.rooms,
    mensagens:           estado.mensagens,
    carregandoRooms:     estado.carregandoRooms,
    carregandoMensagens: estado.carregandoMensagens,
    hasMore:             estado.hasMore,
    typing:              estado.typing,
    roomAtual,
    carregarRooms,
    selecionarRoom,
    enviarMensagem,
    carregarMaisAntigas,
    emitirTyping,
    totalNaoLidas,
  };
}
