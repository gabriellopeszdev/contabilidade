'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Building2, Mail, Loader2, CheckCircle2 } from 'lucide-react';

export default function RecuperarSenhaPage() {
  const [email,    setEmail]    = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [erro,     setErro]     = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');

    try {
      await fetch('/api/v1/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      // Sempre mostra sucesso (não revela se e-mail existe)
      setEnviado(true);
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
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar senha</h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            Informe seu e-mail e enviaremos um link de redefinição
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {enviado ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm text-gray-700 text-center font-medium">
                Se esse e-mail estiver cadastrado, você receberá o link em breve.
              </p>
              <p className="text-xs text-gray-400 text-center">
                Verifique sua caixa de entrada e a pasta de spam.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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

              {erro && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando || !email}
                className="btn-primary w-full"
              >
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {enviando ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link href="/" className="text-xs text-blue-600 hover:underline">
              ← Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
