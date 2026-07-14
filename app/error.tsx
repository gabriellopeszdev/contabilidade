'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { FiscoHubLogo } from './components/FiscoHubLogo';

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

  /* 28 camadas de extrusion — mesma técnica do 404, cor rose */
  const extrusion = Array.from({ length: 28 }, (_, i) => {
    const d = i + 1;
    const l = Math.max(18, 42 - i * 0.9);
    return `${d}px ${d}px 0 hsl(345, 65%, ${l}%)`;
  }).join(', ') + ', 30px 30px 40px rgba(0,0,0,0.85)';

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col antialiased">

      {/* Header */}
      <header className="border-b border-white/5 shrink-0">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
          </Link>
          <nav className="hidden sm:flex items-center gap-6">
            <Link href="/#planos"     className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Planos</Link>
            <Link href="/privacidade" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Privacidade</Link>
            <Link href="/login"
              className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-all">
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center overflow-hidden">

        {/* 500 em 3D isométrico */}
        <div className="select-none mb-8" style={{ perspective: '900px', transform: 'translateX(-9%)' }}>
          <div style={{
            display: 'inline-block',
            transform: 'rotateX(22deg) rotateY(-28deg) skewX(2deg)',
            transformStyle: 'preserve-3d',
          }}>
            <span style={{
              display: 'block',
              fontSize: 'clamp(6.5rem, 20vw, 13rem)',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: '#fca5a5',
              textShadow: extrusion,
            }}>
              500
            </span>
          </div>
        </div>

        {/* Texto */}
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-400 mb-3">
          Ops!
        </p>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">
          Algo deu errado
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed max-w-xs mb-2">
          Ocorreu um erro inesperado no servidor.<br />
          Tente novamente em instantes.
        </p>

        {error.digest && (
          <p className="text-xs text-slate-700 font-mono mb-8 mt-1">ID: {error.digest}</p>
        )}
        {!error.digest && <div className="mb-8" />}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-violet-600/25"
          >
            <RefreshCw size={15} />
            Tentar novamente
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-all"
          >
            <ArrowLeft size={15} />
            Voltar ao início
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 shrink-0">
        <div className="max-w-6xl mx-auto px-8 py-4 text-center text-[11px] text-slate-700">
          © {new Date().getFullYear()} FiscoHub · Sistema self-hosted · LGPD Compliant
        </div>
      </footer>
    </div>
  );
}
