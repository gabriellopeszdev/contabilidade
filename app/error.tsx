'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle size={32} className="text-red-400" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white mb-2">Algo deu errado</h1>
          <p className="text-sm text-slate-400">
            Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-600 mt-2 font-mono">ID: {error.digest}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800
            text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          <RefreshCw size={15} />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
