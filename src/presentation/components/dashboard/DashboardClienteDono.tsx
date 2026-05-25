'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Search,
  Filter,
  Download,
  Loader2,
  EyeOff,
  FileCode2,
} from 'lucide-react';

import { useDocumentosCliente, type SetorFiltro } from '../../hooks/useDocumentosCliente';
import { useAuth } from '../../hooks/useAuth';
import { BannerBoletosCliente } from '../financeiro/BannerBoletosCliente';

// =============================================================================
// Helpers e configs
// =============================================================================

type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL';
type Origem    = 'UPLOAD_CLIENTE' | 'UPLOAD_CONTADOR';
type Aba       = 'pendentes' | 'historico';

const SETOR_BADGE: Record<SetorTipo, { label: string; badge: string }> = {
  FISCAL:   { label: 'Fiscal',   badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  PESSOAL:  { label: 'Pessoal',  badge: 'bg-pink-100 text-pink-700 border-pink-200'       },
  CONTABIL: { label: 'Contábil', badge: 'bg-teal-100 text-teal-700 border-teal-200'       },
};

// Ícone do card usa a cor do setor em vez do tipo de arquivo
const SETOR_ICON: Record<SetorTipo, { bg: string; cor: string }> = {
  FISCAL:   { bg: 'bg-indigo-50', cor: 'text-indigo-500' },
  PESSOAL:  { bg: 'bg-pink-50',   cor: 'text-pink-500'   },
  CONTABIL: { bg: 'bg-teal-50',   cor: 'text-teal-500'   },
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// DashboardClienteDono
// =============================================================================

export default function DashboardClienteDono() {
  const { token } = useAuth();
  const {
    documentos,
    carregando,
    erro,
    total,
    page,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    setor,
    setSetor,
    setPage,
    baixarDocumento,
    baixandoIds,
    revalidar,
  } = useDocumentosCliente();

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [aba,          setAba]          = useState<Aba>('pendentes');
  const [busca,        setBusca]        = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState<Origem | ''>('');

  // Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  const fecharToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(fecharToast, 5000);
    return () => clearTimeout(t);
  }, [toast, fecharToast]);

  // Marcar como lido sem abrir download
  const [marcandoIds, setMarcandoIds] = useState<Set<string>>(new Set());
  const marcarComoLido = useCallback(async (id: string) => {
    setMarcandoIds((prev) => new Set([...prev, id]));
    try {
      await fetch(`/api/v1/documentos/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally {
      setMarcandoIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      revalidar();
    }
  }, [token, revalidar]);

  const handleBaixar = useCallback(async (id: string) => {
    try {
      await baixarDocumento(id);
    } catch (err) {
      setToast({ tipo: 'erro', msg: err instanceof Error ? err.message : 'Erro ao baixar.' });
    }
  }, [baixarDocumento]);

  // ── Contadores das abas ─────────────────────────────────────────────────────
  const pendentesCount = documentos.filter((d) => !d.readStatus).length;

  // ── Filtro aplicado ─────────────────────────────────────────────────────────
  const docsFiltrados = useMemo(() => {
    return documentos.filter((d) => {
      if (aba === 'pendentes' &&  d.readStatus) return false;
      if (aba === 'historico' && !d.readStatus) return false;
      if (busca.trim() && !d.fileName.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroOrigem && d.origem !== filtroOrigem) return false;
      return true;
    });
  }, [documentos, aba, busca, filtroOrigem]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-6xl mx-auto">

      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Meus Documentos</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Documentos enviados pelo seu contador. Clique em baixar para fazer o download.
        </p>
      </div>

      <BannerBoletosCliente token={token} />

      {/* ── Totalizadores ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-center px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-lg font-bold text-amber-700">{pendentesCount}</p>
          <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Pendentes</p>
        </div>
        <div className="text-center px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
          <p className="text-lg font-bold text-emerald-700">
            {documentos.filter((d) => d.readStatus).length}
          </p>
          <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Lidos</p>
        </div>
        <div className="text-center px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-lg font-bold text-slate-700">{total}</p>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Total</p>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1" aria-label="Abas de documentos">
          {(
            [
              { id: 'pendentes', label: 'Pendentes' },
              { id: 'historico', label: 'Histórico' },
            ] as { id: Aba; label: string }[]
          ).map(({ id, label }) => {
            const ativo = aba === id;
            return (
              <button
                key={id}
                onClick={() => { setAba(id); setPage(1); }}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2
                  transition-colors focus-visible:outline-none
                  ${ativo
                    ? 'border-sky-600 text-sky-700 dark:text-sky-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                {label}
                {id === 'pendentes' && pendentesCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px]
                    rounded-full px-1 text-[10px] font-bold bg-red-500 text-white leading-none">
                    {pendentesCount > 99 ? '99+' : pendentesCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do arquivo…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900
              text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400 shrink-0" />

          <select
            value={setor ?? ''}
            onChange={(e) => { setSetor((e.target.value || undefined) as SetorFiltro | undefined); setPage(1); }}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900
              text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:[color-scheme:dark]"
          >
            <option value="">Todos os Setores</option>
            <option value="FISCAL">Fiscal</option>
            <option value="PESSOAL">Pessoal</option>
            <option value="CONTABIL">Contábil</option>
          </select>

          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem(e.target.value as Origem | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900
              text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:[color-scheme:dark]"
          >
            <option value="">Todas as Origens</option>
            <option value="UPLOAD_CLIENTE">Enviado por mim</option>
            <option value="UPLOAD_CONTADOR">Escritório</option>
          </select>
        </div>
      </div>

      {/* ── Conteúdo da aba ─────────────────────────────────────────────────── */}
      {carregando && documentos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 size={24} className="animate-spin text-sky-500" />
          <p className="text-sm text-slate-500">Carregando documentos…</p>
        </div>
      ) : erro ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">Erro ao carregar</p>
            <p className="text-xs text-red-600 mt-0.5">{erro.message}</p>
          </div>
        </div>
      ) : docsFiltrados.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          {aba === 'pendentes' ? (
            <>
              <CheckCircle2 size={28} className="text-emerald-400" />
              <p className="text-sm font-semibold text-slate-600">
                {busca || setor || filtroOrigem
                  ? 'Nenhum documento pendente com esses filtros.'
                  : 'Nenhum documento pendente. Tudo em dia!'}
              </p>
            </>
          ) : (
            <>
              <FileText size={28} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Nenhum documento no histórico.</p>
              <p className="text-xs text-slate-400">
                {busca || setor || filtroOrigem
                  ? 'Tente ajustar os filtros.'
                  : 'Documentos lidos aparecerão aqui.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docsFiltrados.map((doc) => {
              const setor_    = doc.sector as SetorTipo;
              const badgeCfg  = SETOR_BADGE[setor_];
              const iconCfg   = SETOR_ICON[setor_] ?? { bg: 'bg-gray-50', cor: 'text-gray-400' };
              const isPDF     = doc.fileType === 'PDF';
              const isBaixando = baixandoIds.has(doc.id);
              const isMarcando = marcandoIds.has(doc.id);

              return (
                <div
                  key={doc.id}
                  className={`
                    bg-white dark:bg-gray-900 rounded-2xl border flex flex-col transition-shadow hover:shadow-md
                    ${!doc.readStatus ? 'border-sky-200 dark:border-sky-900/30 shadow-sm' : 'border-gray-200 dark:border-gray-700'}
                  `}
                >
                  {/* Cabeçalho do card */}
                  <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                    {/* Ícone colorido pelo setor */}
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconCfg.bg}`}>
                      {isPDF
                        ? <FileText   size={18} className={iconCfg.cor} />
                        : <FileCode2  size={18} className={iconCfg.cor} />
                      }
                    </div>

                    {/* Badges direita */}
                    <div className="flex-1 flex flex-wrap gap-1 justify-end pt-0.5">
                      {badgeCfg && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px]
                          font-bold uppercase tracking-wide border ${badgeCfg.badge}`}>
                          {badgeCfg.label}
                        </span>
                      )}
                      {!doc.readStatus && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px]
                          font-bold bg-blue-500 text-white leading-none animate-pulse">
                          NOVO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nome e meta */}
                  <div className="px-4 pb-3 flex-1">
                    <p
                      className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2"
                      title={doc.fileName}
                    >
                      {doc.fileName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                      <span>{formatarData(doc.createdAt)}</span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span>{doc.origem === 'UPLOAD_CLIENTE' ? 'Por você' : 'Escritório'}</span>
                    </div>
                    {doc.readStatus && doc.readAt && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600">
                        <CheckCircle2 size={10} />
                        <span>Lido em {formatarData(doc.readAt)}</span>
                      </div>
                    )}
                  </div>

                  {/* Rodapé */}
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      {isPDF ? 'PDF' : 'XML'} · {formatarTamanho(doc.fileSizeBytes)}
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Marcar como lido — só para não-lidos do escritório */}
                      {!doc.readStatus && doc.origem === 'UPLOAD_CONTADOR' && (
                        <button
                          onClick={() => marcarComoLido(doc.id)}
                          disabled={isMarcando || isBaixando}
                          title="Marcar como lido"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                            text-gray-500 dark:text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 dark:border-gray-700
                            hover:border-emerald-200 disabled:opacity-40 transition-colors"
                        >
                          {isMarcando
                            ? <Loader2 size={12} className="animate-spin" />
                            : <CheckCircle2 size={12} />
                          }
                          <span className="hidden sm:inline">Lido</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleBaixar(doc.id)}
                        disabled={isBaixando || isMarcando}
                        title="Baixar arquivo"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                          text-gray-500 dark:text-gray-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 border border-gray-200 dark:border-gray-700
                          hover:border-sky-200 dark:hover:border-sky-900/30 disabled:opacity-40 transition-colors"
                      >
                        {isBaixando
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Download size={12} />
                        }
                        Baixar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500 dark:text-gray-400">
              {docsFiltrados.length} documento{docsFiltrados.length !== 1 ? 's' : ''}
              {busca || filtroOrigem ? ' (filtrado)' : ''}
              {' · Pág. '}{page}/{totalPages || 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={!hasPreviousPage}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600
                  bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={!hasNextPage}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600
                  bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}

      {/* Avisos legais */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
        <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
        <div className="text-xs text-emerald-800 space-y-0.5">
          <p className="font-semibold">Documentos protegidos por lei</p>
          <p>
            Armazenados por no mínimo <strong>5 anos</strong> conforme o{' '}
            <strong>CTN Art. 173</strong>.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 shrink-0">
          <FileArchive size={16} className="text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Precisa de documentos mais antigos?</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Entre em contato com seu contador para solicitar acesso ao arquivo histórico.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-start gap-3 rounded-xl shadow-lg border p-4 pr-3
            ${toast.tipo === 'sucesso' ? 'bg-white dark:bg-gray-900 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-gray-900 border-red-200 dark:border-red-800'}`}>
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle  size={18} className="text-red-500 shrink-0 mt-0.5" />
            }
            <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{toast.msg}</p>
            <button type="button" onClick={fecharToast} className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
