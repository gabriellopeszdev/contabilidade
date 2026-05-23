'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default function ClienteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[ClienteError]', error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100
            flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Erro ao carregar página</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Não foi possível exibir este conteúdo. Tente novamente ou volte à tela inicial.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 mt-2 font-mono">Ref: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.push('/documentos')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm
              font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={14} />
            Início
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800
              text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
