'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent, useImperativeHandle, forwardRef } from 'react';
import { Send, Loader2, ArrowUp, MessageSquare, Paperclip, X, FileText, FileCode2 } from 'lucide-react';
import type { ChatMensagem, TypingInfo } from '../../hooks/useChat';

// =============================================================================
// ChatWindow — janela de conversa estilo WhatsApp
// =============================================================================

export interface ChatWindowHandle {
  inserirTexto: (texto: string) => void;
}

interface ChatWindowProps {
  mensagens:        ChatMensagem[];
  carregando:       boolean;
  hasMore:          boolean;
  typing:           TypingInfo | null;
  userId:           string;
  nomeDestinatario: string;
  roomId:           string | null;
  onEnviar:         (content: string, documentId?: string) => Promise<boolean>;
  onCarregarMais:   () => Promise<void>;
  onTyping:         (isTyping: boolean) => void;
  onUploadAnexo:    (roomId: string, file: File) => Promise<{ documentId: string; nome: string } | null>;
  semSala?:         boolean;
}

function formatarHoraMensagem(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarDataSeparador(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const diff = Math.floor((hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(function ChatWindow({
  mensagens,
  carregando,
  hasMore,
  typing,
  userId,
  nomeDestinatario,
  roomId,
  onEnviar,
  onCarregarMais,
  onTyping,
  onUploadAnexo,
  semSala = false,
}, ref) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [anexo, setAnexo] = useState<{ documentId: string; nome: string } | null>(null);
  const [uploadandoAnexo, setUploadandoAnexo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgCountRef = useRef(0);

  useImperativeHandle(ref, () => ({
    inserirTexto: (t: string) => {
      setTexto((prev) => {
        const base = prev.trimEnd();
        return base ? `${base} ${t}` : t;
      });
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  }));

  // Auto-scroll: usa scrollIntoView na âncora inferior
  useEffect(() => {
    if (mensagens.length > prevMsgCountRef.current) {
      const lastMsg = mensagens[mensagens.length - 1];
      const isMe = lastMsg?.senderId === userId;
      const el = scrollRef.current;
      if (el) {
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (isMe || nearBottom) {
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          });
        }
      }
    }
    prevMsgCountRef.current = mensagens.length;
  }, [mensagens, userId]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!carregando && bottomRef.current) {
      bottomRef.current.scrollIntoView();
    }
  }, [carregando]);

  // Typing indicator
  const handleTextoChange = useCallback(
    (valor: string) => {
      setTexto(valor);
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), 1500);
    },
    [onTyping],
  );

  // File selection → upload
  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !roomId) return;
      e.target.value = '';
      setUploadandoAnexo(true);
      const resultado = await onUploadAnexo(roomId, file);
      if (resultado) setAnexo(resultado);
      setUploadandoAnexo(false);
    },
    [roomId, onUploadAnexo],
  );

  // Submit
  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if ((!texto.trim() && !anexo) || enviando) return;

      setEnviando(true);
      onTyping(false);
      const sucesso = await onEnviar(texto.trim(), anexo?.documentId);
      if (sucesso) {
        setTexto('');
        setAnexo(null);
        inputRef.current?.focus();
      }
      setEnviando(false);
    },
    [texto, anexo, enviando, onEnviar, onTyping],
  );

  // Enter to send, Shift+Enter for newline
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Scroll to load more
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || carregando || !hasMore) return;
    if (scrollRef.current.scrollTop < 60) {
      onCarregarMais();
    }
  }, [carregando, hasMore, onCarregarMais]);

  // ------------------------------------------------------------------
  // Placeholder when no room selected
  // ------------------------------------------------------------------
  if (semSala) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-950/50 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
          <MessageSquare size={28} className="text-blue-400" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
          Selecione uma conversa
        </h3>
        <p className="text-xs text-gray-400 max-w-xs">
          Escolha um cliente na lista ao lado para iniciar ou continuar uma conversa.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Agrupa mensagens por data para inserir separadores
  // ------------------------------------------------------------------
  let lastDate = '';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50/30 dark:bg-gray-950/50">
      {/* Header */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
          {nomeDestinatario
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0].toUpperCase())
            .join('')}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{nomeDestinatario}</p>
          {typing && (
            <p className="text-[10px] text-blue-600 animate-pulse">
              {typing.nome} está digitando…
            </p>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col"
      >
        {/* Load more indicator */}
        {hasMore && (
          <button
            onClick={onCarregarMais}
            disabled={carregando}
            className="mx-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 mb-3"
          >
            {carregando ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <ArrowUp size={10} />
            )}
            Carregar anteriores
          </button>
        )}

        {carregando && mensagens.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-blue-500" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={24} className="text-gray-300 mb-2" />
            <p className="text-xs text-gray-400">Nenhuma mensagem ainda. Diga olá!</p>
          </div>
        ) : (
          mensagens.map((msg) => {
            const isMe = msg.senderId === userId;
            const dataMsg = new Date(msg.createdAt).toDateString();
            let mostrarSeparador = false;
            if (dataMsg !== lastDate) {
              lastDate = dataMsg;
              mostrarSeparador = true;
            }

            return (
              <div key={msg.id}>
                {/* Separador de data */}
                {mostrarSeparador && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium shrink-0">
                      {formatarDataSeparador(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>
                )}

                {/* Bolha */}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                  <div
                    className={`
                      max-w-[75%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed
                      ${isMe
                        ? 'bg-primary text-white rounded-br-none self-end'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none self-start shadow-sm'
                      }
                    `}
                  >
                    {/* Nome do remetente — só em mensagens recebidas (lado esquerdo) */}
                    {!isMe && (
                      <p className="text-[10px] font-semibold mb-0.5 text-primary">
                        {msg.senderNome}
                      </p>
                    )}
                    {msg.content && (
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    {msg.documentId && (
                      <a
                        href={`/api/v1/documentos/${msg.documentId}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 mt-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                          isMe
                            ? 'bg-white/20 text-white hover:bg-white/30'
                            : 'bg-gray-300/50 dark:bg-gray-600/50 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        <FileText size={12} className="shrink-0" />
                        Ver anexo
                      </a>
                    )}
                    <p className={`text-[9px] mt-1 ${isMe ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'} text-right`}>
                      {formatarHoraMensagem(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing bubble */}
        {typing && (
          <div className="flex justify-start mb-1">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Âncora de scroll — sempre no final da lista */}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shrink-0">
        {/* Attachment preview */}
        {anexo && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            {anexo.nome.toLowerCase().endsWith('.xml') ? (
              <FileCode2 size={14} className="text-blue-500 shrink-0" />
            ) : (
              <FileText size={14} className="text-blue-500 shrink-0" />
            )}
            <span className="text-xs text-blue-700 dark:text-blue-300 truncate flex-1">{anexo.nome}</span>
            <button
              type="button"
              onClick={() => setAnexo(null)}
              className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xml,application/pdf,application/xml,text/xml"
          className="hidden"
          onChange={handleFileSelected}
        />

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!roomId || uploadandoAnexo}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {uploadandoAnexo ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Paperclip size={16} />
            )}
          </button>
          <textarea
            ref={inputRef}
            value={texto}
            onChange={(e) => handleTextoChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary max-h-32 overflow-y-auto"
            style={{ minHeight: '38px' }}
          />
          <button
            type="submit"
            disabled={(!texto.trim() && !anexo) || enviando || uploadandoAnexo}
            className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center hover:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {enviando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
});
