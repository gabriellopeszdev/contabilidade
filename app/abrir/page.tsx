'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function urlSegura(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    const sefaz = host.includes('sefaz') && host.endsWith('.gov.br');
    const fazenda = host === 'fazenda.gov.br' || host.endsWith('.fazenda.gov.br');
    if (!sefaz && !fazenda) return null;
    u.protocol = 'https:';
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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 p-6 text-center bg-white dark:bg-gray-950">
      <p className="text-sm text-gray-600 dark:text-gray-300">Abrindo consulta na SEFAZ…</p>
      <a
        href={destino}
        className="min-h-[44px] inline-flex items-center justify-center px-4 rounded-lg bg-primary text-white text-sm font-semibold"
      >
        Continuar
      </a>
      <button
        type="button"
        onClick={() => router.back()}
        className="min-h-[44px] px-4 text-sm text-gray-500"
      >
        Voltar
      </button>
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
