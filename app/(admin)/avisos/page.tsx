'use client';

import { useState } from 'react';
import { Megaphone, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

export default function AvisosPage() {
  const { token } = useAuth();

  const [titulo,    setTitulo]    = useState('');
  const [mensagem,  setMensagem]  = useState('');
  const [enviando,  setEnviando]  = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; enviados?: number; message?: string } | null>(null);

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !titulo.trim() || !mensagem.trim()) return;
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch('/api/v1/admin/avisos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ titulo: titulo.trim(), mensagem: mensagem.trim() }),
      });
      const data = await res.json() as { ok?: boolean; enviados?: number; message?: string };
      if (!res.ok) {
        setResultado({ ok: false, message: data.message ?? 'Erro ao enviar aviso.' });
      } else {
        setResultado({ ok: true, enviados: data.enviados });
        setTitulo('');
        setMensagem('');
      }
    } catch {
      setResultado({ ok: false, message: 'Erro de conexão.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100">Avisos para Contadores</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Envie um aviso para todos os escritórios ativos na plataforma.
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleEnviar} className="bg-slate-900 border border-slate-800 border-l-2 border-l-violet-500 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800/80">
          <div className="p-1.5 rounded-lg bg-violet-600/15">
            <Megaphone size={15} className="text-violet-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100">Novo Aviso</h2>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-950/30 border border-amber-700/25">
            <Megaphone size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Este aviso será enviado como notificação in-app para <strong>todos os contadores ativos</strong>.
              Use para comunicar manutenções, novas funcionalidades ou mudanças importantes.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="titulo" className="block text-xs font-medium text-slate-300">
              Título <span className="text-slate-500 font-normal">(máx 200 caracteres)</span>
            </label>
            <input
              id="titulo"
              type="text"
              value={titulo}
              maxLength={200}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Manutenção programada — domingo às 02:00"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2
                         text-sm text-slate-100 placeholder:text-slate-600
                         focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition"
            />
            <p className="text-[10px] text-slate-600 text-right">{titulo.length}/200</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="mensagem" className="block text-xs font-medium text-slate-300">
              Mensagem <span className="text-slate-500 font-normal">(máx 500 caracteres)</span>
            </label>
            <textarea
              id="mensagem"
              rows={4}
              value={mensagem}
              maxLength={500}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva o aviso em detalhes..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2
                         text-sm text-slate-100 placeholder:text-slate-600 resize-none
                         focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition"
            />
            <p className="text-[10px] text-slate-600 text-right">{mensagem.length}/500</p>
          </div>

          {resultado && (
            <div className={`flex items-start gap-3 p-3.5 rounded-lg border
              ${resultado.ok
                ? 'bg-emerald-950/30 border-emerald-700/40 text-emerald-300'
                : 'bg-red-950/30 border-red-700/40 text-red-300'}`}>
              {resultado.ok
                ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                : <AlertCircle  size={14} className="text-red-400 shrink-0 mt-0.5" />
              }
              <p className="text-xs leading-relaxed">
                {resultado.ok
                  ? `Aviso enviado para ${resultado.enviados} escritório(s) com sucesso.`
                  : resultado.message}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={enviando || !titulo.trim() || !mensagem.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500
                         text-white text-sm font-semibold transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-sm shadow-violet-900/30"
            >
              {enviando
                ? <Loader2 size={14} className="animate-spin" />
                : <Send     size={14} />}
              {enviando ? 'Enviando…' : 'Enviar para todos os escritórios'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
