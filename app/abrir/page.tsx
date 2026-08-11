'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';

function urlSegura(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const sefaz = host.includes('sefaz') && host.endsWith('.gov.br');
    const fazenda = host === 'fazenda.gov.br' || host.endsWith('.fazenda.gov.br');
    if (!sefaz && !fazenda) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function AbrirExternoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = useMemo(() => urlSegura(params.get('u')), [params]);

  if (!destino) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-6 text-center bg-white dark:bg-gray-950">
        <p className="text-sm text-gray-600 dark:text-gray-300">Link inválido.</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="min-h-[44px] px-4 rounded-lg bg-primary text-white text-sm font-semibold"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-white dark:bg-gray-950">
      <header className="shrink-0 flex items-center gap-1 px-1 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar ao FiscoHub"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={20} />
        </button>
        <p className="flex-1 min-w-0 text-xs font-mono text-gray-500 dark:text-gray-400 truncate">{destino}</p>
        <button
          type="button"
          aria-label="Copiar URL"
          onClick={() => {
            void navigator.clipboard.writeText(destino);
            toast.success('URL copiada');
          }}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Copy size={16} />
        </button>
      </header>
      <iframe
        title="Consulta SEFAZ"
        src={destino}
        className="flex-1 w-full border-0 bg-white"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export default function AbrirExternoPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-white dark:bg-gray-950" />}>
      <AbrirExternoInner />
    </Suspense>
  );
}
