'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams }           from 'next/navigation';
import { Building2, Lock, Mail, Loader2 }       from 'lucide-react';

import { useAuth } from '../src/presentation/hooks/useAuth';

// =============================================================================
// Página raiz — /
//
// Comportamento:
//   • Se o usuário já estiver autenticado (token válido no localStorage)
//     → redireciona para a rota padrão da role (Contador → /dashboard, Cliente → /documentos)
//   • Caso contrário → exibe o formulário de login
//
// Após autenticação bem-sucedida, o redirect é determinado pela role do JWT
// ou pelo query param `?redirect=` (definido pelo middleware).
// =============================================================================

/** Rota padrão pós-login por role */
const ROTA_DEFAULT: Record<string, string> = {
  Contador: '/dashboard',
  Cliente:  '/inicio',
  Admin:    '/dashboard-admin',
};

/** Rotas válidas para cada role (prefixo). Evita redirecionar role errada. */
const ROTAS_PERMITIDAS: Record<string, string[]> = {
  Contador: ['/dashboard', '/lote', '/clientes', '/configuracoes', '/calendario', '/chat'],
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

function HomeContent() {
  const router          = useRouter();
  const searchParams    = useSearchParams();
  const { usuario, carregando, login, role } = useAuth();

  const [email,    setEmail]    = useState('');
  const [senha,    setSenha]    = useState('');
  const [erro,     setErro]     = useState('');
  const [enviando, setEnviando] = useState(false);

  // Se já autenticado, vai direto para a rota da role
  useEffect(() => {
    if (!carregando && usuario && role) {
      const redirect = searchParams.get('redirect');
      router.replace(rotaSegura(role, redirect));
    }
  }, [carregando, usuario, role, router, searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');

    try {
      await login(email, senha);
      // Após login, o useEffect acima detecta a mudança de `usuario`
      // e faz o redirect correto. Fazemos aqui também para UX imediata.
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : 'Credenciais inválidas. Verifique o e-mail e a senha.',
      );
    } finally {
      setEnviando(false);
    }
  };

  // Tela de loading enquanto lê o localStorage
  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Login form
  // ---------------------------------------------------------------------------
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4
                 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900"
    >
      <div className="w-full max-w-sm">

        {/* Logotipo e título */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Gestão Contábil
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Acesso restrito — faça login para continuar
          </p>
        </div>

        {/* Card de login */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* E-mail */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contador@escritorio.com.br"
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label
                htmlFor="senha"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-9"
                />
              </div>
            </div>

            {/* Mensagem de erro */}
            {erro && (
              <p
                role="alert"
                className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                           rounded-xl px-3 py-2 leading-snug"
              >
                {erro}
              </p>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={enviando || !email || !senha}
              className="btn-primary w-full"
            >
              {enviando && <Loader2 size={15} className="animate-spin" />}
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>

            <div className="text-center">
              <a
                href="/auth/recuperar-senha"
                className="text-xs text-blue-600 hover:underline"
              >
                Esqueci minha senha
              </a>
            </div>

          </form>
        </div>

        {/* Rodapé */}
        <p className="text-center text-slate-500 text-xs mt-6 space-x-1">
          <span>Sistema self-hosted</span>
          <span aria-hidden="true">&bull;</span>
          <span>LGPD Compliant</span>
          <span aria-hidden="true">&bull;</span>
          <span>Dados armazenados localmente</span>
        </p>

        <div className="flex items-center justify-center gap-3 mt-3 text-[11px] text-slate-400">
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">
            Política de Privacidade
          </a>
          <span>|</span>
          <a href="/termos" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">
            Termos de Uso
          </a>
        </div>

      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
