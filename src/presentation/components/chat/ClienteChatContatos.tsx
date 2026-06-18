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
  FISCAL:   { label: 'Fiscal',   cls: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' },
  PESSOAL:  { label: 'Pessoal',  cls: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' },
  CONTABIL: { label: 'Contábil', cls: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'         },
  TODOS:    { label: 'Geral',    cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'             },
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 w-64 shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 shrink-0">
        <Users size={15} className="text-primary" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Seu Escritório</h2>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {carregando ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ordenadas.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10 px-4">
            Nenhum contato encontrado.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-gray-800">
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
                        ? 'bg-gray-100 dark:bg-gray-800 border-l-2 border-primary'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 border-l-2 border-transparent'
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
                          ? ativo ? 'bg-primary-light text-primary-dark' : 'bg-primary-light text-primary-dark'
                          : ativo ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }
                      `}>
                        {iniciais(nome)}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${ativo ? 'text-primary-dark dark:text-primary' : 'text-gray-900 dark:text-gray-100'}`}>
                          {nome}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {room.ultimaMensagem && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {formatarHora(room.ultimaMensagem.createdAt)}
                            </span>
                          )}
                          {room.naoLidas > 0 && (
                            <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center px-1">
                              {room.naoLidas > 99 ? '99+' : room.naoLidas}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tipo */}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {room.membroTipo === 'CONTADOR' ? 'Contador principal' : 'Funcionário'}
                      </p>

                      {/* Prévia da última mensagem */}
                      {room.ultimaMensagem ? (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {room.ultimaMensagem.senderType === 'CLIENTE' ? 'Você: ' : ''}
                          {room.ultimaMensagem.content}
                        </p>
                      ) : (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 italic">Nenhuma mensagem</p>
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
