'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function urlSegura(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function AbrirExternoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const destino = useMemo(() => urlSegura(params.get('u')), [params]);

  useEffect(() => {
    if (destino) window.location.replace(destino);
  }, [destino]);

  if (!destino) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-6 text-center">
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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Loader2 size={24} className="animate-spin text-primary" />
      <p className="text-sm text-gray-600 dark:text-gray-300">Abrindo a consulta da SEFAZ…</p>
      <a href={destino} className="text-sm text-primary hover:underline break-all max-w-md">
        {destino}
      </a>
    </div>
  );
}

export default function AbrirExternoPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <AbrirExternoInner />
    </Suspense>
  );
}
