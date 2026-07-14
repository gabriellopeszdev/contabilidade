'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams }           from 'next/navigation';
import {
  Lock, Mail, Loader2, ShieldCheck, KeyRound,
  Eye, EyeOff, Shield, Zap, Users,
} from 'lucide-react';
import Link from 'next/link';
import { FiscoHubLogo } from '../components/FiscoHubLogo';

import { useAuth, Requer2FAError } from '../../src/presentation/hooks/useAuth';
import { validarEmail }            from '../../src/utils/validators';

const ROTA_DEFAULT: Record<string, string> = {
  Contador: '/dashboard',
  Cliente:  '/inicio',
  Admin:    '/dashboard-admin',
};

const ROTAS_PERMITIDAS: Record<string, string[]> = {
  Contador: ['/dashboard', '/lote', '/clientes', '/configuracoes', '/calendario', '/chat', '/relatorios', '/assinaturas', '/busca'],
  Cliente:  ['/inicio', '/documentos', '/enviar', '/ajuda', '/chat', '/financeiro'],
  Admin:    ['/dashboard-admin', '/contadores', '/faturamento', '/admin-config', '/webhook-logs', '/admin-boletos', '/admin-clientes'],
};

function rotaSegura(role: string, redirect: string | null): string {
  const padrao = ROTA_DEFAULT[role] ?? '/dashboard';
  if (!redirect) return padrao;
  const permitidas = ROTAS_PERMITIDAS[role] ?? [];
  const isPermitida = permitidas.some(
    (r) => redirect === r || redirect.startsWith(r + '/'),
  );
  return isPermitida ? redirect : padrao;
}

/* ─── Painel esquerdo — identidade FiscoHub ─── */
function PainelEsquerdo() {
  return (
    <div className="hidden lg:flex lg:w-[58%] relative flex-col overflow-hidden bg-[#070c18]">

      {/* Orb principal — gradiente violet/blue */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, #2563eb 50%, transparent 70%)' }}
      />
      {/* Orb secundário inferior */}
      <div
        className="pointer-events-none absolute -bottom-48 right-0 w-[450px] h-[450px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #2563eb 0%, #7c3aed 60%, transparent 75%)' }}
      />

      {/* Grid sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-10 pt-8">
        <FiscoHubLogo size="md" className="[&_span]:!text-white" />
        <div className="flex items-center gap-2">
          <Link
            href="/privacidade"
            className="text-xs text-white/40 border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white/60 transition-all"
          >
            Privacidade
          </Link>
          <Link
            href="/#planos"
            className="text-xs text-white/40 border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/5 hover:text-white/60 transition-all"
          >
            Planos
          </Link>
        </div>
      </div>

      {/* Headline */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-10 pb-10">
        <div className="inline-flex items-center gap-2 mb-5">
          <span className="h-px w-8 bg-violet-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
            Plataforma Contábil
          </span>
        </div>

        <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.1] max-w-[400px]">
          Seu escritório,<br />
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            organizado e eficiente.
          </span>
        </h1>

        <p className="mt-5 text-slate-400 text-sm leading-relaxed max-w-sm">
          Gestão fiscal inteligente para contadores modernos. Clientes, documentos, assinaturas e financeiro em um só lugar.
        </p>

        {/* Bullets */}
        <div className="mt-10 space-y-4">
          {[
            { Icon: Shield, label: 'Dados protegidos com LGPD e criptografia' },
            { Icon: Zap,    label: 'Automação de obrigações fiscais e lembretes' },
            { Icon: Users,  label: 'Portal dedicado para cada cliente' },
          ].map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 shrink-0">
                <Icon size={14} className="text-violet-400" />
              </div>
              <span className="text-sm text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rodapé esquerdo */}
      <div className="relative z-10 px-10 pb-8">
        <p className="text-[11px] text-white/20">
          Sistema self-hosted · LGPD Compliant · Dados armazenados localmente
        </p>
      </div>
    </div>
  );
}

/* ─── Painel direito — form glassmorphism ─── */
function PainelDireito({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col bg-[#0a0f1e] min-h-screen">
      {/* Logo mobile */}
      <div className="lg:hidden flex items-center px-5 py-4 border-b border-white/5">
        <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
      </div>

      <div className="flex-1 flex flex-col justify-between px-5 sm:px-10 py-8 sm:py-12 max-w-[420px] w-full mx-auto">
        <div className="flex-1 flex flex-col justify-center">
          {children}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-1.5">
          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-600">
            <Link href="/privacidade" className="hover:text-slate-400 transition-colors">
              Política de Privacidade
            </Link>
            <span>·</span>
            <Link href="/termos" className="hover:text-slate-400 transition-colors">
              Termos de Uso
            </Link>
          </div>
          <p className="text-[11px] text-slate-700">© {new Date().getFullYear()} FiscoHub</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Classes compartilhadas ─── */
const inputCls =
  'w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 ' +
  'focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all text-base sm:text-sm';

const btnPrimary =
  'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm text-white ' +
  'bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed ' +
  'transition-all active:scale-95 shadow-lg shadow-violet-600/25 min-h-[48px]';

/* ─── Componente principal ─── */
function LoginContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { usuario, carregando, login, finalizarLogin, role } = useAuth();

  const [email,        setEmail]        = useState('');
  const [senha,        setSenha]        = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro,         setErro]         = useState('');
  const [enviando,     setEnviando]     = useState(false);

  const [step,       setStep]       = useState<'LOGIN' | 'TOTP' | 'BACKUP'>('LOGIN');
  const [tempToken,  setTempToken]  = useState('');
  const [totpCode,   setTotpCode]   = useState('');
  const [backupCode, setBackupCode] = useState('');

  const erroRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (erro && erroRef.current) erroRef.current.focus();
  }, [erro]);

  useEffect(() => {
    if (!carregando && usuario && role) {
      const redirect = searchParams.get('redirect');
      router.replace(rotaSegura(role, redirect));
    }
  }, [carregando, usuario, role, router, searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro('');
    if (!validarEmail(email)) { setErro('Informe um e-mail válido.'); return; }
    if (!senha)               { setErro('Informe a senha.');           return; }
    setEnviando(true);
    try {
      await login(email, senha);
    } catch (err) {
      if (err instanceof Requer2FAError) {
        setTempToken(err.tempToken);
        setStep('TOTP');
      } else {
        setErro(err instanceof Error ? err.message : 'Credenciais inválidas. Verifique o e-mail e a senha.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleTotpSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true); setErro('');
    try {
      const res  = await fetch('/api/v1/auth/2fa/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, totpToken: totpCode }),
      });
      const data = (await res.json()) as { token?: string; message?: string };
      if (!res.ok) { setErro(data.message ?? 'Código inválido.'); return; }
      finalizarLogin(data.token ?? '');
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const handleBackupSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true); setErro('');
    try {
      const res  = await fetch('/api/v1/auth/2fa/backup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, backupCode }),
      });
      const data = (await res.json()) as { token?: string; message?: string };
      if (!res.ok) { setErro(data.message ?? 'Código de backup inválido.'); return; }
      finalizarLogin(data.token ?? '');
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const ErroAlert = erro ? (
    <p
      ref={erroRef}
      role="alert"
      tabIndex={-1}
      className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5 leading-snug focus:outline-none"
    >
      {erro}
    </p>
  ) : null;

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-violet-500" />
      </div>
    );
  }

  /* ── TOTP ── */
  if (step === 'TOTP') {
    return (
      <div className="min-h-screen flex">
        <PainelEsquerdo />
        <PainelDireito>
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-6">
            <ShieldCheck size={22} className="text-violet-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Verificação em dois fatores</h2>
          <p className="text-slate-500 text-sm mb-6 sm:mb-8">Digite o código do seu aplicativo autenticador</p>

          <form onSubmit={handleTotpSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="totp" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Código de 6 dígitos
              </label>
              <div className="relative">
                <ShieldCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  id="totp" type="text" inputMode="numeric" autoComplete="one-time-code"
                  maxLength={6} required value={totpCode}
                  onChange={(e) => { setErro(''); setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                  placeholder="000000"
                  className={`${inputCls} pl-9 tracking-[0.3em] text-center`}
                />
              </div>
            </div>
            {ErroAlert}
            <button type="submit" disabled={enviando || totpCode.length !== 6} className={btnPrimary}>
              {enviando && <Loader2 size={14} className="animate-spin" />}
              {enviando ? 'Verificando…' : 'Verificar'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setErro(''); setStep('BACKUP'); }}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Usar código de backup
              </button>
            </div>
          </form>
        </PainelDireito>
      </div>
    );
  }

  /* ── BACKUP ── */
  if (step === 'BACKUP') {
    return (
      <div className="min-h-screen flex">
        <PainelEsquerdo />
        <PainelDireito>
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-6">
            <KeyRound size={22} className="text-violet-400" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Código de backup</h2>
          <p className="text-slate-500 text-sm mb-6 sm:mb-8">Digite um dos seus códigos de recuperação</p>

          <form onSubmit={handleBackupSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="backup" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Código de recuperação
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  id="backup" type="text" autoComplete="off" required value={backupCode}
                  onChange={(e) => { setErro(''); setBackupCode(e.target.value); }}
                  placeholder="xxxxxxxx-xxxx"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
            {ErroAlert}
            <button type="submit" disabled={enviando || !backupCode.trim()} className={btnPrimary}>
              {enviando && <Loader2 size={14} className="animate-spin" />}
              {enviando ? 'Verificando…' : 'Verificar'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setErro(''); setStep('TOTP'); }}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Voltar
              </button>
            </div>
          </form>
        </PainelDireito>
      </div>
    );
  }

  /* ── LOGIN ── */
  return (
    <div className="min-h-screen flex">
      <PainelEsquerdo />

      <PainelDireito>
        {/* Cabeçalho do form */}
        <div className="mb-6 sm:mb-8">
          <p className="text-violet-400 text-xs font-semibold uppercase tracking-widest mb-2">
            Acesso à plataforma
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Bem-vindo de volta</h2>
          <p className="text-slate-500 text-sm mt-1">
            Insira suas credenciais para continuar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* E-mail */}
          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              E-mail
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input
                id="email" type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contador@escritorio.com.br"
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="senha" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Senha
              </label>
              <Link
                href="/auth/recuperar-senha"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pl-9 pr-10`}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                tabIndex={-1}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              >
                {mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {ErroAlert}

          <div className="pt-1">
            <button type="submit" disabled={enviando || !email || !senha} className={btnPrimary}>
              {enviando && <Loader2 size={14} className="animate-spin" />}
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
        </form>
      </PainelDireito>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-violet-500" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
