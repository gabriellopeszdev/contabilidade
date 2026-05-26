'use client';
import { useState } from 'react';
import Link from 'next/link';

interface Passo {
  id:        string;
  titulo:    string;
  descricao: string;
  href:      string;
  concluido: boolean;
}

interface OnboardingData {
  passos:          Passo[];
  totalConcluidos: number;
  total:           number;
  concluido:       boolean;
}

async function fetchOnboarding(): Promise<OnboardingData | null> {
  try {
    const r = await fetch('/api/v1/onboarding');
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

async function patchOnboarding(body: { passoId?: string; concluirTudo?: boolean }): Promise<void> {
  await fetch('/api/v1/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function OnboardingChecklist() {
  const [data, setData]     = useState<OnboardingData | null | 'loading'>('loading');
  const [aberto, setAberto] = useState(true);

  // Lazy-load on first render
  if (data === 'loading') {
    setData(null); // prevent re-trigger
    fetchOnboarding().then(setData);
    return null;
  }

  if (!data || data.concluido) return null;

  const progressoPct = Math.round((data.totalConcluidos / data.total) * 100);

  async function marcarConcluido(passoId: string) {
    await patchOnboarding({ passoId });
    const atualizado = await fetchOnboarding();
    setData(atualizado);
  }

  async function dispensar() {
    await patchOnboarding({ concluirTudo: true });
    setData(null);
  }

  if (!aberto) return (
    <button
      onClick={() => setAberto(true)}
      className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full px-4 py-2 shadow-lg text-sm font-medium z-50"
    >
      Primeiros passos ({data.totalConcluidos}/{data.total})
    </button>
  );

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Primeiros passos</h3>
          <p className="text-xs text-gray-400">{data.totalConcluidos} de {data.total} concluídos</p>
        </div>
        <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">&times;</button>
      </div>
      <div className="h-1 bg-gray-100 dark:bg-gray-800">
        <div className="h-1 bg-blue-600 rounded transition-all duration-300" style={{ width: `${progressoPct}%` }} />
      </div>
      <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
        {data.passos.map((p) => (
          <div key={p.id} className={`flex gap-3 items-start ${p.concluido ? 'opacity-50' : ''}`}>
            <button
              onClick={() => !p.concluido && marcarConcluido(p.id)}
              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${p.concluido ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
            >
              {p.concluido && <span className="text-white text-[10px] font-bold">✓</span>}
            </button>
            <div>
              <Link href={p.href} className="text-sm font-medium hover:underline text-gray-900 dark:text-gray-100">
                {p.titulo}
              </Link>
              <p className="text-xs text-gray-400 mt-0.5">{p.descricao}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-100 dark:border-gray-800">
        <button onClick={dispensar} className="text-xs text-gray-400 hover:underline w-full text-center">
          Não mostrar mais
        </button>
      </div>
    </div>
  );
}
