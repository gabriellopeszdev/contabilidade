'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FileSignature, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink, Filter, Download, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

type StatusAssinatura = 'TODOS' | 'PENDENTE' | 'ASSINADO' | 'RECUSADO' | 'EXPIRADO';

interface Assinatura {
  id:              string;
  status:          string;
  signatarioNome:  string;
  signatarioEmail: string;
  expiresAt:       string;
  assinadoAt:      string | null;
  motivoRecusa:    string | null;
  createdAt:       string;
  tokenAssinatura: string;
  documentoId:     string;
  documentoNome:   string;
  documentoTipo:   string;
  temComprovante:  boolean;
  ipAssinatura:           string | null;
  hashDocumento:          string;
  provider:        string;
  zapsignDocToken: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; icon: React.ReactNode }> = {
  PENDENTE:  { label: 'Pendente',  cor: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800', icon: <Clock size={12} /> },
  ASSINADO:  { label: 'Assinado',  cor: 'bg-green-100  text-green-800  border-green-200  dark:bg-green-900/30  dark:text-green-400  dark:border-green-800',  icon: <CheckCircle2 size={12} /> },
  RECUSADO:  { label: 'Recusado',  cor: 'bg-red-100    text-red-800    border-red-200    dark:bg-red-900/30    dark:text-red-400    dark:border-red-800',    icon: <XCircle size={12} /> },
  EXPIRADO:  { label: 'Expirado',  cor: 'bg-gray-100   text-gray-600   border-gray-200   dark:bg-gray-700      dark:text-gray-400   dark:border-gray-600',  icon: <AlertCircle size={12} /> },
};

const FILTROS: { value: StatusAssinatura; label: string }[] = [
  { value: 'TODOS',    label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendentes' },
  { value: 'ASSINADO', label: 'Assinados' },
  { value: 'RECUSADO', label: 'Recusados' },
  { value: 'EXPIRADO', label: 'Expirados' },
];

export default function AssinaturasPage() {
  const { getToken } = useAuth();
  const [filtro, setFiltro]           = useState<StatusAssinatura>('TODOS');
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [carregando, setCarregando]   = useState(true);
  const [erro, setErro]               = useState('');
  const [drawerAssinatura, setDrawerAssinatura] = useState<Assinatura | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const token = await getToken();
      const params = filtro !== 'TODOS' ? `?status=${filtro}` : '';
      const res = await fetch(`/api/v1/assinaturas${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { assinaturas: Assinatura[] };
      setAssinaturas(data.assinaturas);
    } catch {
      setErro('Erro ao carregar assinaturas. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [filtro, getToken]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirLinkAssinatura(token: string) {
    const appUrl = window.location.origin;
    window.open(`${appUrl}/assinar/${token}`, '_blank');
  }

  async function baixarComprovante(id: string, nomeDoc: string) {
    try {
      const token = await getToken();
      const res = await fetch(`/api/v1/assinaturas/${id}/comprovante`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: 'follow',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        toast.error(data.message ?? 'Não foi possível baixar o comprovante.');
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${nomeDoc.replace(/\.pdf$/i, '')}_assinado.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro de conexão ao baixar o comprovante.');
    }
  }

  const counts = assinaturas.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileSignature size={24} className="text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assinaturas</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie solicitações de assinatura eletrônica</p>
          </div>
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          className="flex items-center justify-center gap-2 min-h-[44px] px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['PENDENTE', 'ASSINADO', 'RECUSADO', 'EXPIRADO'] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFiltro(filtro === s ? 'TODOS' : s)}
              className={`p-4 rounded-xl border text-left transition-all ${
                filtro === s
                  ? 'ring-2 ring-primary ' + cfg.cor
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{counts[s] ?? 0}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{cfg.label}{(counts[s] ?? 0) !== 1 ? 's' : ''}</div>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400 dark:text-gray-500" />
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`min-h-[44px] px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === f.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Estado de carregamento */}
      {carregando && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {/* Erro */}
      {erro && !carregando && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">{erro}</div>
      )}

      {/* Vazio */}
      {!carregando && !erro && assinaturas.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <FileSignature size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma solicitação de assinatura encontrada</p>
          <p className="text-xs mt-1">As solicitações aparecem aqui quando você pede assinatura de um documento</p>
        </div>
      )}

      {/* Tabela */}
      {!carregando && assinaturas.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {assinaturas.map((a) => {
              const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.EXPIRADO;
              return (
                <li key={a.id} className="p-4 space-y-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{a.documentoNome}</p>
                    <p className="text-xs text-gray-400 truncate">{a.signatarioNome} · {a.signatarioEmail}</p>
                    <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cor}`}>
                      {cfg.icon}{cfg.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(a.status === 'PENDENTE' || a.status === 'EXPIRADO') && (
                      <button
                        onClick={() => abrirLinkAssinatura(a.tokenAssinatura)}
                        className="inline-flex items-center justify-center gap-1 min-h-[44px] text-xs font-medium text-primary border border-primary/30 rounded-lg"
                      >
                        <ExternalLink size={12} />
                        Ver link
                      </button>
                    )}
                    {a.status === 'ASSINADO' && a.temComprovante && (
                      <button
                        onClick={() => baixarComprovante(a.id, a.documentoNome)}
                        className="inline-flex items-center justify-center gap-1 min-h-[44px] text-xs font-medium text-emerald-600 border border-emerald-200 dark:border-emerald-800 rounded-lg"
                      >
                        <Download size={12} />
                        Baixar assinado
                      </button>
                    )}
                    <button
                      onClick={() => setDrawerAssinatura(a)}
                      className="inline-flex items-center justify-center gap-1 min-h-[44px] text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <ShieldCheck size={12} />
                      Auditoria
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-left">Signatário</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Enviado em</th>
                  <th className="px-4 py-3 text-left">Vencimento</th>
                  <th className="px-4 py-3 text-left">Conclusão</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {assinaturas.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.EXPIRADO;
                  const vencido = a.status === 'PENDENTE' && new Date(a.expiresAt) < new Date();
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{a.documentoNome}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{a.documentoTipo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-800 dark:text-gray-200 truncate max-w-[160px]">{a.signatarioNome}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[160px]">{a.signatarioEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cor}`}>
                          {cfg.icon}{cfg.label}
                        </span>
                        {a.motivoRecusa && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[150px] truncate" title={a.motivoRecusa}>
                            {a.motivoRecusa}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={vencido ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
                          {new Date(a.expiresAt).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {a.assinadoAt ? new Date(a.assinadoAt).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(a.status === 'PENDENTE' || a.status === 'EXPIRADO') && (
                            <button
                              onClick={() => abrirLinkAssinatura(a.tokenAssinatura)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary dark:text-primary border border-primary/30 dark:border-primary/30 rounded-lg hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
                            >
                              <ExternalLink size={12} />
                              Ver link
                            </button>
                          )}
                          {a.status === 'ASSINADO' && a.temComprovante && (
                            <button
                              onClick={() => baixarComprovante(a.id, a.documentoNome)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                            >
                              <Download size={12} />
                              Baixar assinado
                            </button>
                          )}
                          <button
                            onClick={() => setDrawerAssinatura(a)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            <ShieldCheck size={12} />
                            Auditoria
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
            {assinaturas.length} solicitaç{assinaturas.length !== 1 ? 'ões' : 'ão'}
          </div>
        </div>
      )}
      {drawerAssinatura && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDrawerAssinatura(null)}>
          <div className="fixed inset-0 bg-black/30" />
          <div
            className="relative z-10 w-full max-w-md bg-white dark:bg-gray-900 h-full max-h-[100dvh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Auditoria de Assinatura</h2>
              </div>
              <button onClick={() => setDrawerAssinatura(null)} aria-label="Fechar" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-5">
              {/* Documento */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Documento</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{drawerAssinatura.documentoNome}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{drawerAssinatura.documentoTipo}</p>
              </div>

              {/* Signatário */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Signatário</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{drawerAssinatura.signatarioNome}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{drawerAssinatura.signatarioEmail}</p>
              </div>

              {/* Status e datas */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Linha do Tempo</p>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                    <span className="text-gray-500 dark:text-gray-400">Solicitado em</span>
                    <span className="text-gray-900 dark:text-gray-100">{new Date(drawerAssinatura.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                    <span className="text-gray-500 dark:text-gray-400">Vencimento</span>
                    <span className="text-gray-900 dark:text-gray-100">{new Date(drawerAssinatura.expiresAt).toLocaleString('pt-BR')}</span>
                  </div>
                  {drawerAssinatura.assinadoAt && (
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
                      <span className="text-gray-500 dark:text-gray-400">Assinado em</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">{new Date(drawerAssinatura.assinadoAt).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* IP */}
              {drawerAssinatura.ipAssinatura && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">IP da Assinatura</p>
                  <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded text-gray-900 dark:text-gray-100">{drawerAssinatura.ipAssinatura}</p>
                </div>
              )}

              {/* Hash */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Hash do Documento (SHA-256)</p>
                <p className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-gray-700 dark:text-gray-300 break-all">{drawerAssinatura.hashDocumento}</p>
              </div>

              {/* Provider */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Provedor de Assinatura</p>
                <span className="text-xs px-2 py-1 rounded bg-primary-50 dark:bg-primary/10 text-primary-dark dark:text-primary font-medium border border-primary/30 dark:border-primary/30">
                  {drawerAssinatura.provider === 'INTERNO' ? 'Sistema Interno' : 'ZapSign'}
                </span>
                {drawerAssinatura.zapsignDocToken && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Token ZapSign: {drawerAssinatura.zapsignDocToken}</p>
                )}
              </div>

              {/* Motivo de recusa */}
              {drawerAssinatura.motivoRecusa && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">Motivo da Recusa</p>
                  <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2">{drawerAssinatura.motivoRecusa}</p>
                </div>
              )}

              {/* Baixar comprovante */}
              {drawerAssinatura.status === 'ASSINADO' && drawerAssinatura.temComprovante && (
                <button
                  onClick={() => baixarComprovante(drawerAssinatura.id, drawerAssinatura.documentoNome)}
                  className="w-full flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Download size={15} />
                  Baixar Comprovante Assinado
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
