'use client';

import { useMemo } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import type { ChatRoom } from '../../hooks/useChat';

// =============================================================================
// ChatSidebar — lista de salas de chat com preview e badge de não lidas
// =============================================================================

interface ChatSidebarProps {
  rooms:          ChatRoom[];
  roomAtual:      string | null;
  carregando:     boolean;
  busca:          string;
  onBuscaChange:  (v: string) => void;
  onSelectRoom:   (roomId: string) => void;
}

function formatarHora(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const diffMs = agora.getTime() - d.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias === 0) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDias === 1) return 'Ontem';
  if (diffDias < 7) {
    return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function ChatSidebar({
  rooms,
  roomAtual,
  carregando,
  busca,
  onBuscaChange,
  onSelectRoom,
}: ChatSidebarProps) {
  const filtradas = useMemo(() => {
    if (!busca.trim()) return rooms;
    const termo = busca.toLowerCase();
    return rooms.filter(
      (r) =>
        r.clienteNome.toLowerCase().includes(termo) ||
        r.clienteCnpj.includes(termo),
    );
  }, [rooms, busca]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
          <MessageSquare size={16} className="text-primary" />
          Chat
        </h2>
        {/* Campo de busca */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      {/* Lista de rooms */}
      <div className="flex-1 overflow-y-auto">
        {carregando ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-12 text-center">
            <MessageSquare size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-xs text-gray-400">
              {busca ? 'Nenhum resultado' : 'Nenhuma conversa'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-gray-800">
            {filtradas.map((room) => {
              const ativo = room.id === roomAtual;
              const iniciais = room.clienteNome
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0].toUpperCase())
                .join('');

              return (
                <li key={room.id}>
                  <button
                    onClick={() => onSelectRoom(room.id)}
                    className={`
                      w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                      ${ativo
                        ? 'bg-primary/10 dark:bg-primary/20 border-l-2 border-primary'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-2 border-transparent'
                      }
                    `}
                  >
                    {/* Avatar */}
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                      ${ativo ? 'bg-primary-light text-primary-dark' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}
                    `}>
                      {iniciais}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-semibold truncate ${ativo ? 'text-primary-dark dark:text-primary' : 'text-gray-900 dark:text-gray-100'}`}>
                          {room.clienteNome}
                        </p>
                        {room.ultimaMensagem && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                            {formatarHora(room.ultimaMensagem.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate pr-2">
                          {room.ultimaMensagem
                            ? room.ultimaMensagem.content
                            : 'Nenhuma mensagem ainda'}
                        </p>
                        {room.naoLidas > 0 && (
                          <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center px-1 shrink-0">
                            {room.naoLidas > 99 ? '99+' : room.naoLidas}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
