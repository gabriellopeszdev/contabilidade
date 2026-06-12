'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams }           from 'next/navigation';
import { Lock, Mail, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { FiscoHubLogo } from '../components/FiscoHubLogo';

import { useAuth, Requer2FAError } from '../../src/presentation/hooks/useAuth';
import { validarEmail } from '../../src/utils/validators';

/** Rota padrão pós-login por role */
const ROTA_DEFAULT: Record<string, string> = {
  Contador: '/dashboard',
  Cliente:  '/inicio',
  Admin:    '/dashboard-admin',
};

/** Rotas válidas para cada role (prefixo). Evita redirecionar role errada. */
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

function LoginContent() {
  const router          = useRouter();
  const searchParams    = useSearchParams();
  const { usuario, carregando, login, finalizarLogin, role } = useAuth();

  const [email,      setEmail]      = useState('');
  const [senha,      setSenha]      = useState('');
  const [erro,       setErro]       = useState('');
  const [enviando,   setEnviando]   = useState(false);

  // 2FA multi-step state
  const [step,       setStep]       = useState<'LOGIN' | 'TOTP' | 'BACKUP'>('LOGIN');
  const [tempToken,  setTempToken]  = useState('');
  const [totpCode,   setTotpCode]   = useState('');
  const [backupCode, setBackupCode] = useState('');

  // Accessibility: ref para foco automático em erro
  const erroRef = useRef<HTMLParagraphElement>(null);

  // Foco automático quando erro é exibido
  useEffect(() => {
    if (erro && erroRef.current) {
      erroRef.current.focus();
    }
  }, [erro]);

  // Se já autenticado, vai direto para a rota da role
  useEffect(() => {
    if (!carregando && usuario && role) {
      const redirect = searchParams.get('redirect');
      router.replace(rotaSegura(role, redirect));
    }
  }, [carregando, usuario, role, router, searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro('');

    if (!validarEmail(email)) {
      setErro('Informe um e-mail válido.');
      return;
    }
    if (!senha) {
      setErro('Informe a senha.');
      return;
    }

    setEnviando(true);

    try {
      await login(email, senha);
    } catch (err) {
      if (err instanceof Requer2FAError) {
        setTempToken(err.tempToken);
        setStep('TOTP');
      } else {
        setErro(
          err instanceof Error
            ? err.message
            : 'Credenciais inválidas. Verifique o e-mail e a senha.',
        );
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleTotpSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');

    try {
      const res = await fetch('/api/v1/auth/2fa/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tempToken, totpToken: totpCode }),
      });
      const data = (await res.json()) as { token?: string; message?: string };
      if (!res.ok) {
        setErro(data.message ?? 'Código inválido. Tente novamente.');
        return;
      }
      finalizarLogin(data.token ?? '');
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const handleBackupSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');

    try {
      const res = await fetch('/api/v1/auth/2fa/backup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tempToken, backupCode }),
      });
      const data = (await res.json()) as { token?: string; message?: string };
      if (!res.ok) {
        setErro(data.message ?? 'Código de backup inválido. Tente novamente.');
        return;
      }
      finalizarLogin(data.token ?? '');
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const ErroAlert = erro ? (
    <p
      ref={erroRef}
      role="alert"
      tabIndex={-1}
      className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                 rounded-xl px-3 py-2 leading-snug focus:outline-none"
    >
      {erro}
    </p>
  ) : null;

  // Step: TOTP
  if (step === 'TOTP') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg mb-4">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Verificação em dois fatores</h1>
            <p className="text-slate-400 text-sm mt-1">Digite o código do seu aplicativo autenticador</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
            <form onSubmit={handleTotpSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="totp" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Código de 6 dígitos
                </label>
                <div className="relative">
                  <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="totp" type="text" inputMode="numeric" autoComplete="one-time-code"
                    maxLength={6} required value={totpCode}
                    onChange={(e) => { setErro(''); setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
                    placeholder="000000"
                    className="input pl-9 tracking-widest text-center"
                  />
                </div>
              </div>
              {ErroAlert}
              <button type="submit" disabled={enviando || totpCode.length !== 6} className="btn-primary w-full">
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {enviando ? 'Verificando…' : 'Verificar'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setErro(''); setStep('BACKUP'); }} className="text-xs text-primary hover:underline">
                  Usar código de backup
                </button>
              </div>
            </form>
          </div>
          <p className="text-center text-slate-500 text-xs mt-6">Sistema self-hosted &bull; LGPD Compliant</p>
        </div>
      </div>
    );
  }

  // Step: Backup Code
  if (step === 'BACKUP') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg mb-4">
              <KeyRound size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Usar código de backup</h1>
            <p className="text-slate-400 text-sm mt-1">Digite um dos seus códigos de recuperação</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
            <form onSubmit={handleBackupSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="backup" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Código de backup
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="backup" type="text" autoComplete="off" required value={backupCode}
                    onChange={(e) => { setErro(''); setBackupCode(e.target.value); }}
                    placeholder="xxxxxxxx-xxxx"
                    className="input pl-9"
                  />
                </div>
              </div>
              {ErroAlert}
              <button type="submit" disabled={enviando || !backupCode.trim()} className="btn-primary w-full">
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {enviando ? 'Verificando…' : 'Verificar'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => { setErro(''); setStep('TOTP'); }} className="text-xs text-primary hover:underline">
                  Voltar
                </button>
              </div>
            </form>
          </div>
          <p className="text-center text-slate-500 text-xs mt-6">Sistema self-hosted &bull; LGPD Compliant</p>
        </div>
      </div>
    );
  }

  // Step: LOGIN
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <FiscoHubLogo size="lg" className="mb-4 [&_span]:!text-white" />
          <p className="text-slate-400 text-sm mt-1">Gestão fiscal inteligente para escritórios modernos</p>
          <p className="text-slate-500 text-xs mt-0.5">Acesso restrito — faça login para continuar</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contador@escritorio.com.br"
                  className="input pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="senha" type="password" autoComplete="current-password" required value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-9"
                />
              </div>
            </div>

            {ErroAlert}

            <button type="submit" disabled={enviando || !email || !senha} className="btn-primary w-full">
              {enviando && <Loader2 size={15} className="animate-spin" />}
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>

            <div className="text-center">
              <a
                href="/auth/recuperar-senha"
                aria-label="Recuperar senha por e-mail"
                className="text-xs text-primary hover:underline"
              >
                Esqueci minha senha
              </a>
            </div>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6 space-x-1">
          <span>Sistema self-hosted</span>
          <span aria-hidden="true">&bull;</span>
          <span>LGPD Compliant</span>
          <span aria-hidden="true">&bull;</span>
          <span>Dados armazenados localmente</span>
        </p>

        <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-slate-400">
          <a
            href="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Política de Privacidade (abre em nova aba)"
            className="hover:text-slate-600 transition-colors"
          >
            Política de Privacidade
          </a>
          <span aria-hidden="true">|</span>
          <a
            href="/termos"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Termos de Uso (abre em nova aba)"
            className="hover:text-slate-600 transition-colors"
          >
            Termos de Uso
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
