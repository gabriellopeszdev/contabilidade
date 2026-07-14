'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams }           from 'next/navigation';
import {
  Lock, Mail, Loader2, ShieldCheck, KeyRound,
  Eye, EyeOff, Shield, Clock, FileCheck,
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

/* ─── Painel esquerdo (compartilhado entre todos os steps) ─── */
function PainelEsquerdo() {
  return (
    <div className="hidden lg:flex lg:w-[62%] relative flex-col overflow-hidden"
         style={{ background: '#14274e' }}>

      {/* Círculos decorativos */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-white/[0.04]" />
      <div className="pointer-events-none absolute top-1/2 right-8 w-52 h-52 rounded-full bg-white/[0.04] -translate-y-1/2" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 w-[480px] h-[480px] rounded-full bg-white/[0.04]" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-10 pt-8">
        <FiscoHubLogo size="md" className="[&_span]:!text-white" />
        <div className="flex items-center gap-2">
          <Link
            href="/privacidade"
            className="text-xs text-white/60 border border-white/15 rounded-lg px-3 py-1.5 hover:bg-white/10 transition-colors"
          >
            Política de Privacidade
          </Link>
          <Link
            href="/#planos"
            className="text-xs text-white/60 border border-white/15 rounded-lg px-3 py-1.5 hover:bg-white/10 transition-colors"
          >
            Planos
          </Link>
        </div>
      </div>

      {/* Headline */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-10 pb-8">
        <h1 className="text-4xl xl:text-[2.75rem] font-bold text-white leading-tight max-w-[420px]">
          Seu escritório,<br />organizado e<br />eficiente.
        </h1>
        <p className="mt-4 text-white/50 text-sm leading-relaxed max-w-xs">
          Acesse o sistema de forma rápida e segura. Tudo que você precisa para gerir seu dia a dia, em um só lugar.
        </p>
      </div>

      {/* Bullets */}
      <div className="relative z-10 px-10 pb-10 space-y-3.5">
        {[
          { Icon: Shield,    label: 'Seus dados protegidos com segurança e sigilo' },
          { Icon: Clock,     label: 'Acesso rápido e disponível quando precisar'   },
          { Icon: FileCheck, label: 'Gestão completa de clientes e documentos fiscais' },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-3 text-white/55">
            <Icon size={16} className="shrink-0" />
            <span className="text-sm">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Layout do painel direito ─── */
function PainelDireito({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col bg-[#f0f2f5] min-h-screen">
      {/* Logo mobile */}
      <div className="lg:hidden flex items-center px-6 py-4" style={{ background: '#14274e' }}>
        <FiscoHubLogo size="sm" className="[&_span]:!text-white" />
      </div>

      <div className="flex-1 flex flex-col justify-between px-8 sm:px-12 py-10 max-w-[420px] w-full mx-auto">
        <div className="flex-1 flex flex-col justify-center">
          {children}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center space-y-1.5">
          <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
            <Link href="/privacidade" className="hover:text-slate-600 transition-colors">
              Política de Privacidade
            </Link>
            <span>·</span>
            <Link href="/termos" className="hover:text-slate-600 transition-colors">
              Termos de Uso
            </Link>
          </div>
          <p className="text-[11px] text-slate-400">FiscoHub · Sistema self-hosted · LGPD Compliant</p>
        </div>
      </div>
    </div>
  );
}

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
      if (!res.ok) { setErro(data.message ?? 'Código inválido. Tente novamente.'); return; }
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
      if (!res.ok) { setErro(data.message ?? 'Código de backup inválido. Tente novamente.'); return; }
      finalizarLogin(data.token ?? '');
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  /* Alerta de erro reutilizável */
  const ErroAlert = erro ? (
    <p
      ref={erroRef}
      role="alert"
      tabIndex={-1}
      className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 leading-snug focus:outline-none"
    >
      {erro}
    </p>
  ) : null;

  /* Classes de input reutilizáveis */
  const inputCls = 'w-full py-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm';

  /* Botão primário */
  const btnCls = 'w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <Loader2 size={32} className="animate-spin text-[#14274e]" />
      </div>
    );
  }

  /* ── Step: TOTP ── */
  if (step === 'TOTP') {
    return (
      <div className="min-h-screen flex">
        <PainelEsquerdo />
        <PainelDireito>
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
               style={{ background: '#14274e' }}>
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Verificação em dois fatores</h2>
          <p className="text-slate-500 text-sm mb-8">Digite o código do seu aplicativo autenticador</p>

          <form onSubmit={handleTotpSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="totp" className="block text-sm font-medium text-slate-700 mb-1.5">
                Código de 6 dígitos
              </label>
              <div className="relative">
                <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="totp" type="text" inputMode="numeric" autoComplete="one-time-code"
                  maxLength={6} required value={totpCode}
                  onChange={(e) => { setErro(''); setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                  placeholder="000000"
                  className={`${inputCls} pl-9 tracking-widest text-center`}
                />
              </div>
            </div>
            {ErroAlert}
            <button type="submit" disabled={enviando || totpCode.length !== 6}
                    className={btnCls} style={{ background: '#14274e' }}>
              {enviando && <Loader2 size={15} className="animate-spin" />}
              {enviando ? 'Verificando…' : 'Verificar'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setErro(''); setStep('BACKUP'); }}
                      className="text-xs text-blue-600 hover:underline">
                Usar código de backup
              </button>
            </div>
          </form>
        </PainelDireito>
      </div>
    );
  }

  /* ── Step: BACKUP ── */
  if (step === 'BACKUP') {
    return (
      <div className="min-h-screen flex">
        <PainelEsquerdo />
        <PainelDireito>
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-6"
               style={{ background: '#14274e' }}>
            <KeyRound size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Código de backup</h2>
          <p className="text-slate-500 text-sm mb-8">Digite um dos seus códigos de recuperação</p>

          <form onSubmit={handleBackupSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="backup" className="block text-sm font-medium text-slate-700 mb-1.5">
                Código de backup
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="backup" type="text" autoComplete="off" required value={backupCode}
                  onChange={(e) => { setErro(''); setBackupCode(e.target.value); }}
                  placeholder="xxxxxxxx-xxxx"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
            {ErroAlert}
            <button type="submit" disabled={enviando || !backupCode.trim()}
                    className={btnCls} style={{ background: '#14274e' }}>
              {enviando && <Loader2 size={15} className="animate-spin" />}
              {enviando ? 'Verificando…' : 'Verificar'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setErro(''); setStep('TOTP'); }}
                      className="text-xs text-blue-600 hover:underline">
                Voltar
              </button>
            </div>
          </form>
        </PainelDireito>
      </div>
    );
  }

  /* ── Step: LOGIN ── */
  return (
    <div className="min-h-screen flex">
      <PainelEsquerdo />

      <PainelDireito>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Bem-vindo de volta</h2>
          <p className="text-slate-500 text-sm mt-1">Insira suas credenciais para acessar a plataforma</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* E-mail */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
              E-mail
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
            <label htmlFor="senha" className="block text-sm font-medium text-slate-700 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {ErroAlert}

          <button
            type="submit"
            disabled={enviando || !email || !senha}
            className={btnCls}
            style={{ background: '#14274e' }}
          >
            {enviando && <Loader2 size={15} className="animate-spin" />}
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="text-center pt-1">
            <Link href="/auth/recuperar-senha" className="text-sm text-blue-600 hover:underline">
              Esqueceu a senha?
            </Link>
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
        <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#14274e]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
