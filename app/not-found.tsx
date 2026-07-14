import Link from 'next/link';
import { FiscoHubLogo } from './components/FiscoHubLogo';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col antialiased">

      {/* Header */}
      <header className="border-b border-white/5 shrink-0">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <Link href="/">
            <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">

        {/* Tag */}
        <div className="inline-flex items-center gap-2 mb-6">
          <span className="h-px w-6 bg-violet-500/60" />
          <span className="text-xs font-semibold uppercase tracking-widest text-violet-400/80">
            Erro 404
          </span>
          <span className="h-px w-6 bg-violet-500/60" />
        </div>

        {/* Número */}
        <h1
          className="font-black leading-none select-none mb-5 tabular-nums"
          style={{
            fontSize: 'clamp(6rem, 20vw, 12rem)',
            background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            opacity: 0.25,
          }}
        >
          404
        </h1>

        <p className="text-xl sm:text-2xl font-bold text-white mb-3 -mt-4">
          Página não encontrada
        </p>
        <p className="text-slate-500 text-sm leading-relaxed max-w-sm mb-8">
          A página que você procura não existe ou foi movida.<br />
          Verifique o endereço ou volte para o início.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-violet-600/20"
          >
            <ArrowLeft size={14} />
            Voltar ao início
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-all"
          >
            Ir para o login
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 shrink-0">
        <div className="max-w-5xl mx-auto px-6 py-4 text-center text-[11px] text-slate-700">
          © {new Date().getFullYear()} FiscoHub · Sistema self-hosted · LGPD Compliant
        </div>
      </footer>
    </div>
  );
}
