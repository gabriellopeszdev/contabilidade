'use client';

import { useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { FiscoHubLogo } from '../components/FiscoHubLogo';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function CadastroForm() {
  const searchParams = useSearchParams();
  const planoInicial = searchParams.get('plano') ?? '';

  const [nome,     setNome]     = useState('');
  const [email,    setEmail]    = useState('');
  const [telefone, setTelefone] = useState('');
  const [cnpj,     setCnpj]     = useState('');
  const [crc,      setCrc]      = useState('');
  const [plano,    setPlano]    = useState(planoInicial || 'Pro');
  const [mensagem, setMensagem] = useState('');

  const [formState,   setFormState]   = useState<FormState>('idle');
  const [errorMsg,    setErrorMsg]    = useState('');

  const handleCnpjChange = useCallback((v: string) => {
    setCnpj(formatCNPJ(v));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:      nome.trim(),
          email:     email.trim(),
          telefone:  telefone.trim() || undefined,
          cnpj:      cnpj.trim()     || undefined,
          crc:       crc.trim()      || undefined,
          planoNome: plano           || undefined,
          mensagem:  mensagem.trim() || undefined,
        }),
      });

      const data = await res.json() as { message?: string };

      if (!res.ok) {
        setErrorMsg(data.message ?? 'Ocorreu um erro. Tente novamente.');
        setFormState('error');
        return;
      }

      setFormState('success');
    } catch {
      setErrorMsg('Falha de conexão. Verifique sua internet e tente novamente.');
      setFormState('error');
    }
  }, [nome, email, telefone, cnpj, crc, plano, mensagem]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white antialiased flex flex-col">

      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
          </Link>
          <Link
            href="/#planos"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={15} />
            Ver planos
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-lg">

          {formState === 'success' ? (
            /* Success state */
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 mb-6">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Interesse registrado!</h1>
              <p className="text-slate-400 mb-2">
                Obrigado, <strong className="text-white">{nome}</strong>!
              </p>
              <p className="text-slate-400 mb-8">
                Entraremos em contato em até 24h no e-mail{' '}
                <strong className="text-white">{email}</strong>.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all hover:scale-105 active:scale-95"
              >
                Voltar para o início
              </Link>
            </div>
          ) : (
            /* Form */
            <>
              <div className="mb-8 text-center sm:text-left">
                <p className="text-violet-400 text-xs font-semibold uppercase tracking-widest mb-2">Contratação</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Comece agora com o FiscoHub
                </h1>
                <p className="text-slate-400 text-sm">
                  Preencha o formulário e nossa equipe entrará em contato em até 24h.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nome completo <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    placeholder="João Silva"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all text-sm"
                  />
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    E-mail profissional <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="joao@escritorio.com.br"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all text-sm"
                  />
                </div>

                {/* Telefone + CNPJ (row) */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      CNPJ do escritório
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      inputMode="numeric"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all text-sm"
                    />
                  </div>
                </div>

                {/* CRC + Plano (row) */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Número CRC
                    </label>
                    <input
                      type="text"
                      value={crc}
                      onChange={(e) => setCrc(e.target.value)}
                      placeholder="CRC-SP/123456"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Plano de interesse
                    </label>
                    <select
                      value={plano}
                      onChange={(e) => setPlano(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all text-sm appearance-none"
                    >
                      <option value="Básico"     className="bg-[#0a0f1e]">Básico — R$89/mês</option>
                      <option value="Pro"        className="bg-[#0a0f1e]">Pro — R$189/mês</option>
                      <option value="Enterprise" className="bg-[#0a0f1e]">Enterprise — R$389/mês</option>
                    </select>
                  </div>
                </div>

                {/* Mensagem */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Mensagem adicional
                  </label>
                  <textarea
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    rows={3}
                    placeholder="Conte-nos mais sobre as necessidades do seu escritório..."
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all text-sm resize-none"
                  />
                </div>

                {/* Error message */}
                {formState === 'error' && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={formState === 'submitting'}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-violet-600/30 mt-2"
                >
                  {formState === 'submitting' ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar interesse'
                  )}
                </button>

                <p className="text-center text-xs text-slate-600">
                  Ao enviar, você concorda com nossa{' '}
                  <Link href="/privacidade" className="text-slate-500 hover:text-slate-400 transition-colors underline">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} FiscoHub · Sistema self-hosted · LGPD Compliant
        </div>
      </footer>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroForm />
    </Suspense>
  );
}
