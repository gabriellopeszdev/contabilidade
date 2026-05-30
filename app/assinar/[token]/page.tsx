'use client';
import { useState, useEffect } from 'react';
import { useParams }           from 'next/navigation';
import { Loader2 }             from 'lucide-react';

interface AssinaturaInfo {
  nomeDocumento:  string;
  signatarioNome: string;
  expiresAt:      string;
  provider:       'INTERNO' | 'DOCSEAL';
  linkExterno:    string | null;
}

export default function AssinarPage() {
  const { token } = useParams<{ token: string }>();
  const [info,   setInfo]   = useState<AssinaturaInfo | null>(null);
  const [erro,   setErro]   = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'loading' | 'assinado' | 'recusado'>('idle');

  useEffect(() => {
    fetch(`/api/v1/assinatura/${token}`)
      .then((r) => r.json())
      .then((d: AssinaturaInfo & { message?: string }) => {
        if (d.message && !d.nomeDocumento) { setErro(d.message); return; }
        if (d.provider === 'DOCSEAL' && d.linkExterno) {
          window.location.replace(d.linkExterno);
          return;
        }
        setInfo(d);
      })
      .catch(() => setErro('Erro ao carregar informações'));
  }, [token]);

  async function assinar() {
    setEstado('loading');
    const r = await fetch(`/api/v1/assinatura/${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ confirmacao: true }),
    });
    setEstado(r.ok ? 'assinado' : 'idle');
  }

  async function recusar() {
    setEstado('loading');
    await fetch(`/api/v1/assinatura/${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ confirmacao: false }),
    });
    setEstado('recusado');
  }

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-2">
        <p className="text-2xl">❌</p>
        <p className="text-red-500 text-lg font-medium">{erro}</p>
      </div>
    </div>
  );

  if (estado === 'assinado') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-green-700">Documento assinado com sucesso!</h1>
        <p className="text-gray-500">Seu escritório contábil foi notificado.</p>
      </div>
    </div>
  );

  if (estado === 'recusado') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="text-6xl">🚫</div>
        <h1 className="text-2xl font-bold text-gray-700">Assinatura recusada</h1>
        <p className="text-gray-500">O escritório foi notificado da recusa.</p>
      </div>
    </div>
  );

  if (!info) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Carregando...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6 mx-4">
        <div className="text-center">
          <div className="text-5xl mb-4">📄</div>
          <h1 className="text-xl font-bold">Assinatura de Documento</h1>
          <p className="text-gray-500 mt-1">Olá, <strong>{info.signatarioNome}</strong></p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="font-medium text-gray-800">{info.nomeDocumento}</p>
          <p className="text-sm text-gray-400 mt-1">
            Expira em: {new Date(info.expiresAt).toLocaleString('pt-BR')}
          </p>
        </div>
        <p className="text-sm text-center text-gray-500">
          Ao clicar em &ldquo;Assinar&rdquo;, você confirma que leu e concorda com o conteúdo
          do documento. Esta ação é registrada com data, hora e IP.
        </p>
        <div className="space-y-3">
          <button
            onClick={assinar}
            disabled={estado === 'loading'}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {estado === 'loading' ? 'Processando...' : 'Assinar Documento'}
          </button>
          <button
            onClick={recusar}
            disabled={estado === 'loading'}
            className="w-full border border-gray-200 py-3 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
}
