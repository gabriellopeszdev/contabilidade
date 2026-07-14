import Link from 'next/link';
import { FiscoHubLogo } from './components/FiscoHubLogo';
import { ArrowLeft, FileSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col antialiased">

      {/* Orbs decorativos */}
      <div
        className="pointer-events-none fixed -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, #2563eb 50%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed -bottom-48 -right-32 w-[420px] h-[420px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #2563eb 0%, #7c3aed 60%, transparent 75%)' }}
      />

      {/* Grid sutil */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <Link href="/">
            <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
          </Link>
        </div>
      </header>

      {/* Conteúdo central */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center max-w-md">

          {/* Ícone */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-8">
            <FileSearch size={28} className="text-violet-400" />
          </div>

          {/* Número */}
          <p className="text-[7rem] font-bold leading-none bg-gradient-to-b from-white/20 to-transparent bg-clip-text text-transparent select-none mb-2">
            404
          </p>

          <h1 className="text-2xl font-bold text-white mb-3">
            Página não encontrada
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            A página que você está procurando não existe ou foi movida.
            Verifique o endereço ou volte para o início.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-violet-600/25"
            >
              <ArrowLeft size={15} />
              Voltar ao início
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm transition-all"
            >
              Ir para o login
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 text-center text-[11px] text-slate-600">
          © {new Date().getFullYear()} FiscoHub · Sistema self-hosted · LGPD Compliant
        </div>
      </footer>
    </div>
  );
}
