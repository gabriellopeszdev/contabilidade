'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter }     from 'next/navigation';
import Link                          from 'next/link';
import { Building2, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function RedefinirSenhaPage() {
  const params  = useParams<{ token: string }>();
  const router  = useRouter();
  const token   = params.token;

  const [novaSenha,      setNovaSenha]      = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [enviando,       setEnviando]       = useState(false);
  const [sucesso,        setSucesso]        = useState(false);
  const [erro,           setErro]           = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro('');

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, novaSenha }),
      });

      if (res.ok) {
        setSucesso(true);
        setTimeout(() => router.push('/?msg=senha-redefinida'), 2000);
      } else {
        const data = await res.json() as { message?: string };
        setErro(data.message ?? 'Erro ao redefinir a senha. O link pode ter expirado.');
      }
    } catch {
      setErro('Falha na conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Nova senha</h1>
          <p className="text-slate-400 text-sm mt-1">Defina sua nova senha de acesso</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sucesso ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm text-gray-700 font-medium">Senha redefinida com sucesso!</p>
              <p className="text-xs text-gray-400">Redirecionando para o login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="novaSenha" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nova senha
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="novaSenha"
                    type="password"
                    required
                    minLength={8}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmarSenha" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="confirmarSenha"
                    type="password"
                    required
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="input pl-9"
                  />
                </div>
              </div>

              {erro && (
                <div role="alert" className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={enviando || !novaSenha || !confirmarSenha}
                className="btn-primary w-full"
              >
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {enviando ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          )}

          {!sucesso && (
            <div className="mt-5 text-center">
              <Link href="/auth/recuperar-senha" className="text-xs text-primary hover:underline">
                Solicitar novo link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
