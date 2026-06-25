'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { toast } from 'sonner';
import { Bot, Send, Loader2, Lock, Sparkles, User, Trash2 } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface Mensagem {
  id?:       string;
  role:      'user' | 'assistant';
  content:   string;
  createdAt?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatarData(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);

  const mesmoAno = d.getFullYear() === hoje.getFullYear();

  if (d.toDateString() === hoje.toDateString()) return 'Hoje';
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: mesmoAno ? undefined : 'numeric' });
}

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Agrupa mensagens por data para exibir separadores
function agruparPorData(msgs: Mensagem[]): { data: string; mensagens: Mensagem[] }[] {
  const grupos: { data: string; mensagens: Mensagem[] }[] = [];
  for (const msg of msgs) {
    const label = msg.createdAt ? formatarData(msg.createdAt) : '';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.data === label) {
      ultimo.mensagens.push(msg);
    } else {
      grupos.push({ data: label, mensagens: [msg] });
    }
  }
  return grupos;
}

// =============================================================================
// Chat IA — página principal
// =============================================================================

export default function ChatIAPage() {
  const { getToken } = useAuth();

  const [messages,         setMessages]         = useState<Mensagem[]>([]);
  const [input,            setInput]            = useState('');
  const [carregando,       setCarregando]       = useState(false);
  const [carregandoHist,   setCarregandoHist]   = useState(true);
  const [erro,             setErro]             = useState<string | null>(null);
  const [bloqueado,        setBloqueado]        = useState(false);
  const [planMsg,          setPlanMsg]          = useState('');
  const [limpando,         setLimpando]         = useState(false);
  const [confirmLimpar,    setConfirmLimpar]    = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Carrega histórico ao montar
  useEffect(() => {
    let cancelado = false;

    async function carregarHistorico() {
      try {
        const token = await getToken();
        const res = await fetch('/api/v1/chat-ia', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelado) return;

        if (res.status === 403) {
          const data = await res.json() as { message?: string };
          setBloqueado(true);
          setPlanMsg(data.message ?? '');
          return;
        }

        if (!res.ok) {
          if (!cancelado) toast.error('Não foi possível carregar o histórico. Você pode começar uma nova conversa.');
          return;
        }

        const data = await res.json() as { mensagens: Mensagem[] };
        if (!cancelado) setMessages(data.mensagens ?? []);
      } catch {
        if (!cancelado) toast.error('Erro de conexão ao carregar o histórico.');
      } finally {
        if (!cancelado) setCarregandoHist(false);
      }
    }

    void carregarHistorico();
    return () => { cancelado = true; };
  }, [getToken]);

  // Auto-scroll ao receber nova mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, carregando]);

  async function handleEnviar(e?: FormEvent) {
    e?.preventDefault();
    const texto = input.trim();
    if (!texto || carregando) return;

    const agora = new Date().toISOString();
    const mensagemOtimista: Mensagem = { role: 'user', content: texto, createdAt: agora };

    setMessages((prev) => [...prev, mensagemOtimista]);
    setInput('');
    setErro(null);
    setCarregando(true);

    try {
      const token = await getToken();
      const res = await fetch('/api/v1/chat-ia', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ message: texto }),
      });

      const data = await res.json() as { reply?: string; message?: string };

      if (res.status === 403) {
        setBloqueado(true);
        setPlanMsg(data.message ?? 'Disponível apenas no plano Enterprise.');
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!res.ok) {
        setErro(data.message ?? 'Erro ao obter resposta. Tente novamente.');
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (data.reply) {
        const agoraReply = new Date().toISOString();
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply!, createdAt: agoraReply },
        ]);
      }
    } catch {
      setErro('Erro de conexão. Verifique sua internet e tente novamente.');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleLimpar() {
    if (!confirmLimpar) {
      setConfirmLimpar(true);
      setTimeout(() => setConfirmLimpar(false), 3000);
      return;
    }

    setLimpando(true);
    setConfirmLimpar(false);
    try {
      const token = await getToken();
      await fetch('/api/v1/chat-ia', {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages([]);
    } catch {
      // ignora — usuário pode tentar novamente
    } finally {
      setLimpando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleEnviar();
    }
  }

  // ------------------------------------------------------------------
  // UI: plano bloqueado
  // ------------------------------------------------------------------
  if (bloqueado) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 p-8 text-center text-white shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <Lock size={32} className="text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2">Recurso Exclusivo</h2>
          <p className="text-purple-100 text-sm mb-6">{planMsg || 'Disponível apenas no plano Enterprise.'}</p>
          <div className="flex items-center justify-center gap-2 text-purple-200 text-xs">
            <Sparkles size={14} />
            <span>Faça upgrade para desbloquear o Assistente IA</span>
          </div>
        </div>
      </div>
    );
  }

  const grupos = agruparPorData(messages);

  // ------------------------------------------------------------------
  // UI: chat normal
  // ------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col" style={{ maxHeight: 'calc(100vh - 3.5rem)' }}>

      {/* Header */}
      <div className="mb-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Assistente Contábil IA</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tire dúvidas sobre obrigações fiscais, regimes tributários e muito mais
            </p>
          </div>
        </div>

        {/* Botão limpar histórico */}
        {messages.length > 0 && (
          <button
            onClick={() => void handleLimpar()}
            disabled={limpando}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${confirmLimpar
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700'
              }`}
            title={confirmLimpar ? 'Clique novamente para confirmar' : 'Limpar histórico'}
          >
            {limpando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {confirmLimpar ? 'Confirmar limpeza' : 'Nova conversa'}
          </button>
        )}
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 mb-4">

        {/* Carregando histórico */}
        {carregandoHist ? (
          <div className="flex items-center justify-center h-full gap-2 text-gray-400 dark:text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Carregando histórico…</span>
          </div>
        ) : messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/10 flex items-center justify-center mb-4">
              <Bot size={32} className="text-primary dark:text-primary" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
              Olá! Sou seu assistente contábil. Faça uma pergunta sobre obrigações fiscais,
              regimes tributários ou qualquer dúvida contábil.
            </p>
          </div>
        ) : (
          /* Mensagens agrupadas por data */
          <div className="space-y-6">
            {grupos.map((grupo) => (
              <div key={grupo.data}>
                {/* Separador de data */}
                {grupo.data && (
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-2">
                      {grupo.data}
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                  </div>
                )}

                <div className="space-y-3">
                  {grupo.mensagens.map((msg, idx) => (
                    <div
                      key={msg.id ?? idx}
                      className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* Avatar */}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5 ${
                        msg.role === 'user'
                          ? 'bg-primary'
                          : 'bg-gradient-to-br from-blue-500 to-purple-600'
                      }`}>
                        {msg.role === 'user'
                          ? <User size={12} className="text-white" />
                          : <Bot  size={12} className="text-white" />
                        }
                      </div>

                      {/* Balão + hora */}
                      <div className={`flex flex-col gap-0.5 max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-white rounded-tr-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                        }`}>
                          {msg.content.split('\n').map((line, i, arr) => (
                            <span key={i}>
                              {line}
                              {i < arr.length - 1 && <br />}
                            </span>
                          ))}
                        </div>
                        {msg.createdAt && (
                          <span className="text-[9px] text-gray-400 dark:text-gray-500 px-1">
                            {formatarHora(msg.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Indicador de digitação */}
            {carregando && (
              <div className="flex items-end gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-white" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Erro */}
      {erro && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-sm text-red-700 dark:text-red-400 shrink-0">
          {erro}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleEnviar} className="flex items-end gap-2 shrink-0">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={carregando || carregandoHist}
            placeholder="Digite sua pergunta contábil… (Enter para enviar, Shift+Enter para nova linha)"
            rows={1}
            className="w-full resize-none px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:opacity-60"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
        </div>

        <button
          type="submit"
          disabled={carregando || carregandoHist || !input.trim()}
          className="h-10 w-10 rounded-xl bg-primary hover:bg-primary-dark disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-white flex items-center justify-center transition-colors shrink-0"
          aria-label="Enviar mensagem"
        >
          {carregando
            ? <Loader2 size={16} className="animate-spin" />
            : <Send size={16} />
          }
        </button>
      </form>

      <p className="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-600 shrink-0">
        As respostas são sugestões e não substituem a análise de um profissional contábil habilitado.
      </p>
    </div>
  );
}
