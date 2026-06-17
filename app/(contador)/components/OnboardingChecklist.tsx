'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, CheckCircle2, Circle, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface Passo {
  id:        string;
  titulo:    string;
  descricao: string;
  href:      string;
  feature:   string | null;
  concluido: boolean;
}

interface OnboardingData {
  passos:          Passo[];
  totalConcluidos: number;
  total:           number;
  concluido:       boolean;
}

// =============================================================================
// OnboardingChecklist
//
// Exibido apenas para o dono do escritório (isDono).
// Desaparece quando o usuário clica em "Pular" ou conclui todos os passos.
// Os passos são filtrados pelo plano do contador (via API).
// =============================================================================

export function OnboardingChecklist() {
  const { token, isDono } = useAuth();

  const [data,   setData]   = useState<OnboardingData | null>(null);
  const [aberto, setAberto] = useState(true);
  const [carregando, setCarregando] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch da lista de passos
  // ---------------------------------------------------------------------------

  const carregar = useCallback(async () => {
    if (!token || !isDono) return;
    try {
      const res = await fetch('/api/v1/onboarding', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const d = await res.json() as OnboardingData;
      setData(d);
    } catch {
      // falha silenciosa — não bloqueia a interface
    }
  }, [token, isDono]);

  useEffect(() => { void carregar(); }, [carregar]);

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  const marcarConcluido = async (passoId: string) => {
    if (!token || carregando) return;
    setCarregando(true);
    try {
      await fetch('/api/v1/onboarding', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ passoId }),
      });
      await carregar();
    } finally {
      setCarregando(false);
    }
  };

  const pular = async () => {
    if (!token) return;
    try {
      await fetch('/api/v1/onboarding', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ concluirTudo: true }),
      });
    } finally {
      setData(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Guards de renderização
  // ---------------------------------------------------------------------------

  // Só aparece para o dono do escritório
  if (!isDono) return null;

  // Aguarda o carregamento inicial
  if (!data) return null;

  // Onboarding concluído — não exibe nada
  if (data.concluido) return null;

  const progressoPct = data.total > 0
    ? Math.round((data.totalConcluidos / data.total) * 100)
    : 0;

  // ---------------------------------------------------------------------------
  // Estado colapsado — botão flutuante
  // ---------------------------------------------------------------------------

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-primary hover:bg-primary-dark text-white text-sm font-semibold shadow-lg transition-colors"
      >
        <Sparkles size={15} />
        Primeiros passos
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold tabular-nums">
          {data.totalConcluidos}/{data.total}
        </span>
        <ChevronUp size={14} />
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Estado expandido — checklist
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-primary" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Primeiros passos</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {data.totalConcluidos} de {data.total} concluídos
            </p>
          </div>
        </div>
        <button
          onClick={() => setAberto(false)}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Minimizar"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="h-1 bg-gray-100 dark:bg-gray-800">
        <div
          className="h-1 bg-primary transition-all duration-500"
          style={{ width: `${progressoPct}%` }}
        />
      </div>

      {/* Lista de passos */}
      <div className="p-3 space-y-1 max-h-72 overflow-y-auto">
        {data.passos.map((p) => (
          <div
            key={p.id}
            className={`flex gap-3 items-start p-2 rounded-xl transition-colors ${
              p.concluido
                ? 'opacity-50'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
            }`}
          >
            <button
              onClick={() => !p.concluido && void marcarConcluido(p.id)}
              disabled={p.concluido || carregando}
              className="mt-0.5 shrink-0 text-gray-300 dark:text-gray-600 hover:text-primary dark:hover:text-primary
                disabled:cursor-default transition-colors"
              title={p.concluido ? 'Concluído' : 'Marcar como concluído'}
            >
              {p.concluido
                ? <CheckCircle2 size={18} className="text-primary" />
                : <Circle size={18} />
              }
            </button>
            <div className="flex-1 min-w-0">
              <Link
                href={p.href}
                className={`text-sm font-medium leading-tight hover:text-primary dark:hover:text-primary transition-colors ${
                  p.concluido
                    ? 'text-gray-400 dark:text-gray-500 line-through'
                    : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                {p.titulo}
              </Link>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
                {p.descricao}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => void pular()}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500
            hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <X size={12} />
          Pular onboarding
        </button>
      </div>
    </div>
  );
}
