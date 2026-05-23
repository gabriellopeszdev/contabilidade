'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuth }                from '../../src/presentation/hooks/useAuth';
import { useChat }                from '../../src/presentation/hooks/useChat';
import { ChatSidebar }            from '../../src/presentation/components/chat/ChatSidebar';
import { ChatWindow, type ChatWindowHandle } from '../../src/presentation/components/chat/ChatWindow';
import { ClienteChatContatos }    from '../../src/presentation/components/chat/ClienteChatContatos';

// =============================================================================
// /chat — Página de Chat unificada (Contador e Cliente)
//
// Comportamento por role:
//   • Contador/Admin → layout split: sidebar (lista clientes) + chat window
//   • Cliente        → chat window direto (auto-seleciona a única sala)
// =============================================================================

export default function ChatPage() {
  const router = useRouter();
  const { usuario, carregando, getToken, isCliente, isFuncionarioCliente } = useAuth();
  const isVisaoCliente = isCliente || isFuncionarioCliente;
  const [token, setToken] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const chatWindowRef = useRef<ChatWindowHandle>(null);

  useEffect(() => {
    getToken().then(setToken).catch(() => setToken(null));
  }, [getToken]);

  const {
    rooms,
    mensagens,
    carregandoRooms,
    carregandoMensagens,
    hasMore,
    typing,
    roomAtual,
    carregarRooms,
    selecionarRoom,
    enviarMensagem,
    carregarMaisAntigas,
    emitirTyping,
  } = useChat(token);

  // Redirect se não autenticado
  useEffect(() => {
    if (!carregando && !usuario) {
      router.push('/');
    }
  }, [carregando, usuario, router]);

  // Carrega rooms ao mount
  useEffect(() => {
    if (token) carregarRooms();
  }, [token, carregarRooms]);

  // Auto-seleciona o contador principal (primeiro da lista) para cliente
  useEffect(() => {
    if (isVisaoCliente && rooms.length > 0 && !roomAtual) {
      const contador = rooms.find((r) => r.membroTipo === 'CONTADOR') ?? rooms[0];
      selecionarRoom(contador.id);
    }
  }, [isVisaoCliente, rooms, roomAtual, selecionarRoom]);

  if (carregando || !usuario) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  const roomSelecionada = rooms.find((r) => r.id === roomAtual);

  // -----------------------------------------------------------------------
  // Cliente: contacts sidebar (uma sala por membro) + janela de chat
  // -----------------------------------------------------------------------
  if (isVisaoCliente) {
    const roomSelecionada = rooms.find((r) => r.id === roomAtual);
    const nomeDestinatario = roomSelecionada?.membroNome ?? 'Meu Escritório';

    return (
      <div className="flex h-full">
        {/* Sidebar de contatos — oculto em mobile */}
        <div className="hidden md:block">
          <ClienteChatContatos
            rooms={rooms}
            roomAtual={roomAtual}
            carregando={carregandoRooms}
            onSelectRoom={selecionarRoom}
          />
        </div>

        <ChatWindow
          ref={chatWindowRef}
          mensagens={mensagens}
          carregando={carregandoMensagens}
          hasMore={hasMore}
          typing={typing}
          userId={usuario.id}
          nomeDestinatario={nomeDestinatario}
          onEnviar={enviarMensagem}
          onCarregarMais={carregarMaisAntigas}
          onTyping={emitirTyping}
          semSala={!roomAtual}
        />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Contador: sidebar + chat window
  // -----------------------------------------------------------------------
  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 hidden md:block">
        <ChatSidebar
          rooms={rooms}
          roomAtual={roomAtual}
          carregando={carregandoRooms}
          busca={busca}
          onBuscaChange={setBusca}
          onSelectRoom={selecionarRoom}
        />
      </div>

      <ChatWindow
        mensagens={mensagens}
        carregando={carregandoMensagens}
        hasMore={hasMore}
        typing={typing}
        userId={usuario.id}
        nomeDestinatario={roomSelecionada?.clienteNome ?? ''}
        onEnviar={enviarMensagem}
        onCarregarMais={carregarMaisAntigas}
        onTyping={emitirTyping}
        semSala={!roomAtual}
      />
    </div>
  );
}
