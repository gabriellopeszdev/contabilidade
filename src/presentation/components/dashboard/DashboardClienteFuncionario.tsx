'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Search,
  Filter,
  Download,
  Upload,
  Clock,
  Loader2,
  EyeOff,
} from 'lucide-react';

import { useDocumentosCliente, type SetorFiltro } from '../../hooks/useDocumentosCliente';
import { useAuth } from '../../hooks/useAuth';
import { BannerBoletosCliente } from '../financeiro/BannerBoletosCliente';

// =============================================================================
// Helpers
// =============================================================================

type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL' | 'TODOS';
type SetorDocumento = SetorTipo | null;
type Origem    = 'UPLOAD_CLIENTE' | 'UPLOAD_CONTADOR';

const SETOR_CONFIG: Record<SetorTipo, { label: string; classes: string }> = {
  FISCAL:   { label: 'Fiscal',   classes: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  PESSOAL:  { label: 'Pessoal',  classes: 'bg-pink-100   text-pink-700   border-pink-200' },
  CONTABIL: { label: 'Contábil', classes: 'bg-teal-100   text-teal-700   border-teal-200' },
  TODOS:    { label: 'Todos',    classes: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const SETOR_DEFAULT_CONFIG = {
  label: 'A categorizar',
  classes: 'bg-amber-100 text-amber-700 border-amber-200',
};

function getSetorConfig(setor: SetorDocumento) {
  return setor ? SETOR_CONFIG[setor] : SETOR_DEFAULT_CONFIG;
}

const ORIGEM_CONFIG: Record<Origem, { label: string; icone: typeof Upload; classes: string }> = {
  UPLOAD_CLIENTE:  { label: 'Enviado pela empresa',     icone: Upload,   classes: 'text-primary bg-primary/10 dark:bg-primary/20' },
  UPLOAD_CONTADOR: { label: 'Enviado pelo escritório',  icone: Download, classes: 'text-emerald-600 bg-emerald-50' },
};

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// DashboardClienteFuncionario — Visão para funcionário da empresa-cliente
// =============================================================================

export default function DashboardClienteFuncionario() {
  const { usuario, token } = useAuth();
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
  } = useDocumentosCliente();

  // Filtros locais
  const [busca, setBusca] = useState('');
  const [filtroLeitura, setFiltroLeitura] = useState<'lido' | 'nao_lido' | ''>('');
  const [filtroOrigem, setFiltroOrigem] = useState<Origem | ''>('');

  // Toast
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  const fecharToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(fecharToast, 5000);
    return () => clearTimeout(t);
  }, [toast, fecharToast]);

  const handleBaixar = useCallback(async (id: string) => {
    try {
      await baixarDocumento(id);
    } catch (err) {
      setToast({
        tipo: 'erro',
        msg: err instanceof Error ? err.message : 'Erro ao baixar documento.',
      });
    }
  }, [baixarDocumento]);

  const docsFiltrados = useMemo(() => {
    return documentos.filter((d) => {
      if (busca.trim() && !d.fileName.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroLeitura === 'lido' && !d.readStatus) return false;
      if (filtroLeitura === 'nao_lido' && d.readStatus) return false;
      if (filtroOrigem && d.origem !== filtroOrigem) return false;
      return true;
    });
  }, [documentos, busca, filtroLeitura, filtroOrigem]);

  const pendentes = documentos.filter((d) => !d.readStatus).length;
  const lidos     = documentos.filter((d) => d.readStatus).length;

  const setoresLabel = usuario?.setores?.length
    ? usuario.setores.join(', ')
    : 'seus setores';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-6xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Meus Documentos</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Documentos disponíveis para {setoresLabel}.
        </p>
      </div>

      {/* Banner de boletos pendentes/vencidos */}
      <BannerBoletosCliente token={token} />

      {/* Banner informativo */}
      <div className="bg-primary/10 dark:bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
        <ShieldCheck size={18} className="text-primary shrink-0" />
        <p className="text-sm text-primary dark:text-primary">
          Você está visualizando documentos dos setores que possui acesso.
        </p>
      </div>

      {/* Resumo */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <div className="text-center px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
          <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{pendentes}</p>
          <p className="text-[10px] font-medium text-amber-600 dark:text-amber-500 uppercase tracking-wide">Pendentes</p>
        </div>
        <div className="text-center px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30">
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{lidos}</p>
          <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-500 uppercase tracking-wide">Lidos</p>
        </div>
        <div className="text-center px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{total}</p>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</p>
        </div>
      </div>

      {/* Filtros */}
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
              focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400" />

          <select
            value={setor ?? ''}
            onChange={(e) => setSetor((e.target.value || undefined) as SetorFiltro | undefined)}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900
              text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary dark:[color-scheme:dark]"
          >
            <option value="">Todos os Setores</option>
            <option value="FISCAL">Fiscal</option>
            <option value="PESSOAL">Pessoal</option>
            <option value="CONTABIL">Contábil</option>
          </select>

          <select
            value={filtroLeitura}
            onChange={(e) => setFiltroLeitura(e.target.value as 'lido' | 'nao_lido' | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900
              text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary dark:[color-scheme:dark]"
          >
            <option value="">Todos</option>
            <option value="nao_lido">Não lidos</option>
            <option value="lido">Lidos</option>
          </select>

          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem(e.target.value as Origem | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-900
              text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary dark:[color-scheme:dark]"
          >
            <option value="">Todas as Origens</option>
            <option value="UPLOAD_CLIENTE">Enviado pela empresa</option>
            <option value="UPLOAD_CONTADOR">Enviado pelo Escritório</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      {carregando && documentos.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Carregando documentos…</p>
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <FileText size={28} className="text-slate-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-slate-600 dark:text-gray-400">Nenhum documento encontrado</p>
          <p className="text-xs text-slate-400 dark:text-gray-500 max-w-xs">
            {busca.trim() || setor || filtroLeitura || filtroOrigem
              ? 'Tente ajustar os filtros.'
              : 'Nenhum documento disponível para seus setores.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-[1fr_100px_90px_100px_140px_150px_60px] gap-3 px-5 py-3
            border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
            <span>Documento</span>
            <span>Setor</span>
            <span>Tipo</span>
            <span>Tamanho</span>
            <span>Origem</span>
            <span>Leitura</span>
            <span className="text-center">Ações</span>
          </div>

          <ul role="list" className="divide-y divide-slate-100 dark:divide-gray-800">
            {docsFiltrados.map((doc) => {
              const origemCfg  = ORIGEM_CONFIG[doc.origem as Origem] ?? ORIGEM_CONFIG.UPLOAD_CONTADOR;
              const setorCfg   = getSetorConfig((doc.sector as SetorDocumento) ?? null);
              const OrigemIcone = origemCfg.icone;
              const isBaixando = baixandoIds.has(doc.id);

              return (
                <li key={doc.id} className="group">
                  <div className="lg:grid lg:grid-cols-[1fr_100px_90px_100px_140px_150px_60px] gap-3 items-center
                    px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">

                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${origemCfg.classes}`}>
                        <OrigemIcone size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                          {!doc.readStatus && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold
                              bg-primary text-white leading-none tracking-wide animate-pulse">
                              NOVO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400 dark:text-gray-500">
                          <Clock size={10} />
                          <span>{formatarDataHora(doc.createdAt)}</span>
                          <span className="text-slate-300 dark:text-gray-600">·</span>
                          <span>por {doc.uploaderNome}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 lg:mt-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px]
                        font-bold uppercase tracking-wide border ${setorCfg.classes}`}>
                        {setorCfg.label}
                      </span>
                    </div>

                    <div className="mt-1 lg:mt-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px]
                        font-bold uppercase border ${
                          doc.fileType === 'PDF'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/30'
                        }`}>
                        {doc.fileType}
                      </span>
                    </div>

                    <span className="text-xs text-slate-500 dark:text-gray-400 mt-1 lg:mt-0">
                      {formatarTamanho(doc.fileSizeBytes)}
                    </span>

                    <div className="mt-1 lg:mt-0">
                      <span className="text-xs text-slate-500 dark:text-gray-400">
                        {doc.origem === 'UPLOAD_CLIENTE' ? 'Empresa' : 'Escritório'}
                      </span>
                    </div>

                    <div className="mt-2 lg:mt-0">
                      {doc.readStatus ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Lido</p>
                            {doc.readAt && (
                              <p className="text-[10px] text-slate-400 dark:text-gray-500">
                                {formatarDataHora(doc.readAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <EyeOff size={13} className="text-amber-500 shrink-0" />
                          <p className="text-xs font-medium text-amber-600">Não lido</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 lg:mt-0 flex justify-center">
                      <button
                        onClick={() => handleBaixar(doc.id)}
                        disabled={isBaixando}
                        title="Baixar arquivo"
                        className="p-2 rounded-lg text-slate-400 dark:text-gray-500 hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isBaixando ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-gray-400">
              {docsFiltrados.length} documento{docsFiltrados.length !== 1 ? 's' : ''}
              {busca.trim() || filtroLeitura || filtroOrigem ? ' (filtrado)' : ''}
              {' · Página '}{page} de {totalPages || 1}
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
        </div>
      )}

      {/* Aviso legal */}
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 flex items-start gap-3">
        <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-xs text-emerald-800 dark:text-emerald-300 space-y-0.5">
          <p className="font-semibold">Documentos protegidos por lei</p>
          <p>
            Seus documentos são armazenados com segurança por no mínimo{' '}
            <strong>5 anos</strong> conforme o <strong>CTN Art. 173</strong>.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <div
            className={`flex items-start gap-3 rounded-xl shadow-lg border p-4 pr-3 ${
              toast.tipo === 'sucesso'
                ? 'bg-white dark:bg-gray-900 border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-gray-900 border-red-200 dark:border-red-800'
            }`}
          >
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle  size={18} className="text-red-500 shrink-0 mt-0.5" />
            }
            <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{toast.msg}</p>
            <button type="button" onClick={fecharToast} aria-label="Fechar notificação" className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
