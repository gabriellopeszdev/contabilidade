'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Página: /auth/ativar-conta?token=...
//
// Rota pública para clientes ativarem suas contas após convite do contador.
// O token é enviado por e-mail (simulado via logger).
// =============================================================================

function AtivarContaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { finalizarLogin } = useAuth();
  const token = searchParams.get('token') ?? '';

  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!token) {
      setErro('Token de ativação não encontrado na URL.');
      return;
    }

    if (senha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (senha !== confirmar) {
      setErro('As senhas não conferem.');
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch('/api/v1/auth/ativar-conta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha }),
      });

      const data = await res.json() as { message?: string; token?: string };

      if (!res.ok) {
        setErro(data.message ?? 'Erro ao ativar conta.');
        return;
      }

      setSucesso(true);

      if (data.token) {
        finalizarLogin(data.token);
        setTimeout(() => router.push('/documentos'), 1500);
      } else {
        setTimeout(() => router.push('/login'), 1500);
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Link Inválido</h1>
          <p className="text-sm text-gray-500 mt-2">
            Este link de ativação não contém um token válido. Verifique o e-mail de convite.
          </p>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 max-w-md w-full text-center">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Conta Ativada!</h1>
          <p className="text-sm text-gray-500 mt-2">
            Sua conta foi ativada com sucesso. Entrando no portal…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <KeyRound size={28} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Ativar sua Conta</h1>
          <p className="text-sm text-gray-500 mt-1">
            Defina sua senha para acessar o Portal do Cliente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Senha */}
          <div className="space-y-1.5">
            <label htmlFor="senha" className="block text-sm font-medium text-gray-700">
              Nova Senha
            </label>
            <div className="relative">
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900
                           placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary
                           focus:border-transparent transition-shadow"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar senha */}
          <div className="space-y-1.5">
            <label htmlFor="confirmar" className="block text-sm font-medium text-gray-700">
              Confirmar Senha
            </label>
            <input
              id="confirmar"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              minLength={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900
                         placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary
                         focus:border-transparent transition-shadow"
              placeholder="Repita a senha"
              autoComplete="new-password"
            />
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <span className="text-xs text-red-700">{erro}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5
                       text-sm font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {carregando ? <Loader2 size={16} className="animate-spin text-white" /> : <KeyRound size={16} />}
            {carregando ? 'Ativando…' : 'Ativar Conta'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AtivarContaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      }
    >
      <AtivarContaContent />
    </Suspense>
  );
}
