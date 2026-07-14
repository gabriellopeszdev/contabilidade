'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, CheckCircle2, Loader2 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import { useAuth } from '../../../../src/presentation/hooks/useAuth';

interface InfoDetalhe {
  id:               string;
  titulo:           string;
  conteudo:         string;
  exigeConfirmacao: boolean;
  publicadoAt:      string;
  anexoNome:        string | null;
  anexoUrl:         string | null;
  souDestinatario:  boolean;
  lido:             boolean;
  confirmado:       boolean;
}

export default function InformativoDetalhePage() {
  const { token }   = useAuth();
  const router      = useRouter();
  const params      = useParams<{ id: string }>();
  const id          = params.id;

  const [info, setInfo]             = useState<InfoDetalhe | null>(null);
  const [loading, setLoading]       = useState(true);
  const [erro, setErro]             = useState<string | null>(null);
  const [confirmando, setConf]      = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    fetch(`/api/v1/comunicados/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() as Promise<InfoDetalhe> : Promise.reject(r.status))
      .then((d) => {
        setInfo(d);
        setConfirmado(d.confirmado);
      })
      .catch(() => setErro('Informativo não encontrado.'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleConfirmar = useCallback(async () => {
    if (!token || !id) return;
    setConf(true);
    try {
      const res = await fetch(`/api/v1/comunicados/${id}/confirmar`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setConfirmado(true);
    } catch {
      setErro('Erro ao confirmar. Tente novamente.');
    } finally {
      setConf(false);
    }
  }, [token, id]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  if (erro || !info) return (
    <div className="p-6 text-center text-red-500">{erro ?? 'Informativo não encontrado.'}</div>
  );

  const html = DOMPurify.sanitize(info.conteudo);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/informativos')}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">
          {info.titulo}
        </h1>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        {new Date(info.publicadoAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
      </p>

      <div
        className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {info.anexoUrl && (
        <a href={info.anexoUrl} download={info.anexoNome ?? undefined} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 w-fit rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors">
          <Download size={14} /> {info.anexoNome ?? 'Baixar anexo'}
        </a>
      )}

      {info.exigeConfirmacao && info.souDestinatario && (
        confirmado ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Você confirmou o recebimento deste informativo.</p>
          </div>
        ) : (
          <button onClick={handleConfirmar} disabled={confirmando}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors disabled:opacity-50 shadow-sm">
            {confirmando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Li e estou ciente
          </button>
        )
      )}
    </div>
  );
}
