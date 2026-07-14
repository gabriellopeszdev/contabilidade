import Link from 'next/link';
import { FiscoHubLogo } from './components/FiscoHubLogo';
import { ArrowLeft, FileSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col antialiased overflow-hidden">

      {/* Orb central — mais sutil */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-30"
        style={{ background: 'radial-gradient(ellipse, #7c3aed 0%, #2563eb 40%, transparent 70%)' }}
      />

      {/* Grid sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 shrink-0">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
          </Link>
          <Link
            href="/login"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Ir para o login →
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">

        {/* Ícone */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-6">
          <FileSearch size={24} className="text-violet-400" />
        </div>

        {/* Número grande */}
        <div
          className="text-[9rem] sm:text-[11rem] font-black leading-none select-none mb-4 tabular-nums"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.03) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white mb-3">
          Página não encontrada
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-8">
          A página que você está procurando não existe ou foi movida. Verifique o endereço ou volte para o início.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-violet-600/25"
          >
            <ArrowLeft size={14} />
            Voltar ao início
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm transition-all"
          >
            Ir para o login
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 text-center text-[11px] text-slate-700">
          © {new Date().getFullYear()} FiscoHub · Sistema self-hosted · LGPD Compliant
        </div>
      </footer>
    </div>
  );
}
