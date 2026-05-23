'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function ContadorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[ContadorError]', error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20
            flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">Erro ao carregar página</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Não foi possível exibir este conteúdo. Tente novamente ou volte ao dashboard.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-600 mt-2 font-mono">Ref: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm
              font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={14} />
            Dashboard
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700
              text-sm font-semibold text-white hover:bg-slate-600 transition-colors"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
