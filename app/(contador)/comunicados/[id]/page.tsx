'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import { useAuth } from '../../../../src/presentation/hooks/useAuth';
import { DestinatariosTable } from '../../../../src/presentation/components/comunicados/DestinatariosTable';

interface ComunicadoDetalhe {
  id:               string;
  titulo:           string;
  conteudo:         string;
  exigeConfirmacao: boolean;
  targeting:        string;
  setor:            string | null;
  publicadoAt:      string;
  anexoNome:        string | null;
  anexoUrl:         string | null;
}

export default function ComunicadoDetalhePage() {
  const { token } = useAuth();
  const router    = useRouter();
  const params    = useParams<{ id: string }>();
  const id        = params.id;

  const [comunicado, setComunicado] = useState<ComunicadoDetalhe | null>(null);
  const [loading, setLoading]       = useState(true);
  const [erro, setErro]             = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletando, setDeletando]   = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    fetch(`/api/v1/comunicados/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() as Promise<ComunicadoDetalhe> : Promise.reject(r.status))
      .then((d) => setComunicado(d))
      .catch(() => setErro('Comunicado não encontrado.'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleDelete = useCallback(async () => {
    if (!token || !id) return;
    setDeletando(true);
    try {
      const res = await fetch(`/api/v1/comunicados/${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      router.push('/comunicados');
    } catch {
      setErro('Erro ao excluir comunicado.');
      setDeletando(false);
      setConfirmDelete(false);
    }
  }, [token, id, router]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  if (erro || !comunicado) return (
    <div className="p-6 text-center text-red-500">{erro ?? 'Comunicado não encontrado.'}</div>
  );

  const html = DOMPurify.sanitize(comunicado.conteudo);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/comunicados')}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">
          {comunicado.titulo}
        </h1>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span>Publicado em {new Date(comunicado.publicadoAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        {comunicado.exigeConfirmacao && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 font-medium">
            Exige confirmação
          </span>
        )}
      </div>

      <div
        className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {comunicado.anexoUrl && (
        <a href={comunicado.anexoUrl} download={comunicado.anexoNome ?? undefined} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 w-fit rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors">
          <Download size={14} /> {comunicado.anexoNome ?? 'Baixar anexo'}
        </a>
      )}

      {token && (
        <>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Destinatários</h2>
          <DestinatariosTable
            comunicadoId={id}
            exigeConfirmacao={comunicado.exigeConfirmacao}
            token={token}
          />
        </>
      )}

      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 hover:underline">
            <Trash2 size={13} /> Excluir comunicado
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400 flex-1">Confirmar exclusão? Esta ação não pode ser desfeita.</p>
            <button onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancelar</button>
            <button onClick={handleDelete} disabled={deletando}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {deletando ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Excluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
