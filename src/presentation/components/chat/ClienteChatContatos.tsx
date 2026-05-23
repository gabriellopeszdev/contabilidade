'use client';

import { useMemo } from 'react';
import { Users } from 'lucide-react';
import type { ChatRoom } from '../../hooks/useChat';

// =============================================================================
// ClienteChatContatos
//
// Sidebar do portal do cliente: lista de salas de chat, uma por membro do
// escritório (contador principal + funcionários), com badges de setor e
// preview da última mensagem.
// =============================================================================

type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL' | 'TODOS';

interface Props {
  rooms:       ChatRoom[];
  roomAtual:   string | null;
  carregando:  boolean;
  onSelectRoom: (roomId: string) => void;
}

const SETOR_BADGE: Record<string, { label: string; cls: string }> = {
  FISCAL:   { label: 'Fiscal',   cls: 'bg-indigo-100 text-indigo-700' },
  PESSOAL:  { label: 'Pessoal',  cls: 'bg-violet-100 text-violet-700' },
  CONTABIL: { label: 'Contábil', cls: 'bg-teal-100   text-teal-700'   },
  TODOS:    { label: 'Geral',    cls: 'bg-gray-100   text-gray-600'   },
};

function iniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function formatarHora(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const diffDias = Math.floor((agora.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffDias === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function ClienteChatContatos({ rooms, roomAtual, carregando, onSelectRoom }: Props) {
  // Contador sempre primeiro, depois funcionários por nome
  const ordenadas = useMemo(() => {
    return [...rooms].sort((a, b) => {
      if (a.membroTipo === 'CONTADOR' && b.membroTipo !== 'CONTADOR') return -1;
      if (b.membroTipo === 'CONTADOR' && a.membroTipo !== 'CONTADOR') return 1;
      return (a.membroNome ?? '').localeCompare(b.membroNome ?? '', 'pt-BR');
    });
  }, [rooms]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-64 shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <Users size={15} className="text-sky-600" />
        <h2 className="text-sm font-bold text-gray-900">Seu Escritório</h2>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {carregando ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ordenadas.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10 px-4">
            Nenhum contato encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {ordenadas.map((room) => {
              const ativo   = room.id === roomAtual;
              const nome    = room.membroNome ?? 'Desconhecido';
              const setores = (room.membroSetores ?? []).filter((s) => s !== 'TODOS') as SetorTipo[];

              return (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRoom(room.id)}
                    className={`
                      w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                      ${ativo
                        ? 'bg-sky-50 border-l-2 border-sky-500'
                        : 'hover:bg-gray-50 border-l-2 border-transparent'
                      }
                    `}
                  >
                    {/* Avatar */}
                    {room.membroAvatar ? (
                      <img
                        src={room.membroAvatar}
                        alt={nome}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        text-xs font-bold shrink-0
                        ${room.membroTipo === 'CONTADOR'
                          ? ativo ? 'bg-sky-200 text-sky-800' : 'bg-sky-100 text-sky-700'
                          : ativo ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-600'
                        }
                      `}>
                        {iniciais(nome)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${ativo ? 'text-sky-900' : 'text-gray-900'}`}>
                          {nome}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {room.ultimaMensagem && (
                            <span className="text-[10px] text-gray-400">
                              {formatarHora(room.ultimaMensagem.createdAt)}
                            </span>
                          )}
                          {room.naoLidas > 0 && (
                            <span className="min-w-[18px] h-[18px] rounded-full bg-sky-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                              {room.naoLidas > 99 ? '99+' : room.naoLidas}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tipo */}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {room.membroTipo === 'CONTADOR' ? 'Contador principal' : 'Funcionário'}
                      </p>

                      {/* Prévia da última mensagem */}
                      {room.ultimaMensagem ? (
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">
                          {room.ultimaMensagem.senderType === 'CLIENTE' ? 'Você: ' : ''}
                          {room.ultimaMensagem.content}
                        </p>
                      ) : (
                        <p className="text-[10px] text-gray-400 mt-0.5 italic">Nenhuma mensagem</p>
                      )}

                      {/* Badges de setor (só funcionários) */}
                      {room.membroTipo === 'FUNCIONARIO' && setores.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {setores.map((s) => {
                            const b = SETOR_BADGE[s];
                            return b ? (
                              <span
                                key={s}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${b.cls}`}
                              >
                                {b.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
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
