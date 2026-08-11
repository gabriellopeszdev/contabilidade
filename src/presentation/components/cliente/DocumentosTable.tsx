'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  FileText,
  FileCode2,
  Download,
  Loader2,
  AlertCircle,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  CheckSquare,
  Square,
  PackageOpen,
  X,
} from 'lucide-react';

import type {
  DocumentoClienteDTO,
  SetorFiltro,
  CategoriaFiltro,
} from '../../hooks/useDocumentosCliente';

// =============================================================================
// Tipos de Props
// =============================================================================

interface DocumentosTableProps {
  documentos:      DocumentoClienteDTO[];
  carregando:      boolean;
  erro:            Error | null;
  total:           number;
  page:            number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
  setor:           SetorFiltro | undefined;
  categoria:       CategoriaFiltro | undefined;
  baixandoIds:     Set<string>;
  onMudarSetor:    (s: SetorFiltro | undefined) => void;
  onMudarCategoria:(c: CategoriaFiltro | undefined) => void;
  onMudarPagina:   (p: number) => void;
  onBaixar:        (id: string) => Promise<void>;
  onBaixarLote?:   (ids: string[]) => Promise<void>;
}

// =============================================================================
// Configuração das abas
// =============================================================================

interface ConfigAba {
  label: string;
  valor: CategoriaFiltro | undefined;
  cor:   string;
}

const ABAS: ConfigAba[] = [
  { label: 'Todos',              valor: undefined,    cor: 'bg-slate-100 text-slate-700' },
  { label: 'Arquivos XML',       valor: 'xml',        cor: 'bg-blue-100 text-blue-700'   },
  { label: 'Extratos Bancários', valor: 'extratos',   cor: 'bg-emerald-100 text-emerald-700' },
  { label: 'Despesas',           valor: 'despesas',   cor: 'bg-orange-100 text-orange-700' },
  { label: 'Impostos',           valor: 'impostos',   cor: 'bg-red-100 text-red-700'     },
  { label: 'Folha de Pagamento', valor: 'folha',      cor: 'bg-violet-100 text-violet-700' },
  { label: 'Documentos Diversos',valor: 'diversos',   cor: 'bg-gray-100 text-gray-700'   },
];

const COR_CATEGORIA: Record<CategoriaFiltro, string> = {
  xml:      'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800',
  extratos: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800',
  despesas: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800',
  impostos: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800',
  folha:    'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 ring-1 ring-violet-200 dark:ring-violet-800',
  diversos: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700',
};

const LABEL_CATEGORIA: Record<CategoriaFiltro, string> = {
  xml:      'XML',
  extratos: 'Extratos',
  despesas: 'Despesas',
  impostos: 'Impostos',
  folha:    'Folha',
  diversos: 'Diversos',
};

const COR_SETOR: Record<SetorFiltro, string> = {
  FISCAL:   'bg-primary-50 dark:bg-primary/10 text-primary-dark dark:text-primary ring-1 ring-primary/30 dark:ring-primary/20',
  PESSOAL:  'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 ring-1 ring-violet-200 dark:ring-violet-800',
  CONTABIL: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800',
};

const LABEL_SETOR: Record<SetorFiltro, string> = {
  FISCAL:   'Fiscal',
  PESSOAL:  'Pessoal',
  CONTABIL: 'Contábil',
};

// =============================================================================
// Helpers de formatação
// =============================================================================

const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function formatarCompetencia(iso: string | null): string {
  if (!iso) return '—';
  // iso está no formato 'YYYY-MM-DD' (sem timezone) — parse manual para evitar off-by-one
  const [year, month] = iso.split('-').map(Number);
  if (!year || !month) return '—';
  return `${MESES_PT[month - 1]}/${year}`;
}

function formatarData(iso: string): string {
  // Localiza em pt-BR: dia/mês/ano
  return new Date(iso).toLocaleDateString('pt-BR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024)              return `${bytes} B`;
  if (bytes < 1024 * 1024)       return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// Sub-componente: Ícone de tipo de arquivo
// =============================================================================

function FileIcon({ type }: { type: 'XML' | 'PDF' | 'XLSX' | 'XLS' | 'DOCX' | 'DOC' | 'CSV' | 'OFX' | 'ODS' | 'ZIP' | 'RAR' }) {
  if (type === 'XML') {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-200 dark:ring-amber-800 shrink-0">
        <FileCode2 size={15} className="text-amber-600 dark:text-amber-400" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-800 shrink-0">
      <FileText size={15} className="text-red-500 dark:text-red-400" />
    </span>
  );
}

// =============================================================================
// Sub-componente: Linha de documento
// =============================================================================

interface DocumentoLinhaProps {
  doc:           DocumentoClienteDTO;
  baixando:      boolean;
  onBaixar:      (id: string) => Promise<void>;
  modoSelecao?:  boolean;
  selecionado?:  boolean;
  onToggle?:     (id: string) => void;
}

function DocumentoLinha({ doc, baixando, onBaixar, modoSelecao, selecionado, onToggle }: DocumentoLinhaProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
  const [carregandoMeta, setCarregandoMeta] = useState(false);

  const [mostrarVersoes, setMostrarVersoes] = useState(false);
  const [versoes, setVersoes] = useState<Array<{ id: string; versao: number; fileSizeBytes: string; createdAt: string; motivo: string | null }> | null>(null);
  const [carregandoVersoes, setCarregandoVersoes] = useState(false);

  const handleBaixar = useCallback(async () => {
    setErro(null);
    try {
      await onBaixar(doc.id);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Falha ao baixar. Tente novamente.',
      );
      setTimeout(() => setErro(null), 5_000);
    }
  }, [doc.id, onBaixar]);

  const handleExpandir = useCallback(async () => {
    if (doc.fileType !== 'XML') return;
    const novoEstado = !expandido;
    setExpandido(novoEstado);
    if (novoEstado && metadata === null) {
      setCarregandoMeta(true);
      try {
        const r = await fetch(`/api/v1/documentos/${doc.id}/metadata`);
        if (r.ok) {
          const d = await r.json();
          setMetadata(d.metadata ?? {});
        } else {
          setMetadata({});
        }
      } catch {
        setMetadata({});
      } finally {
        setCarregandoMeta(false);
      }
    }
  }, [doc.fileType, doc.id, expandido, metadata]);

  const handleVerVersoes = useCallback(async () => {
    const novoEstado = !mostrarVersoes;
    setMostrarVersoes(novoEstado);
    if (novoEstado && versoes === null) {
      setCarregandoVersoes(true);
      try {
        const r = await fetch(`/api/v1/documentos/${doc.id}/versoes`);
        if (r.ok) {
          const d = await r.json();
          setVersoes(d.versoes ?? []);
        } else {
          setVersoes([]);
        }
      } catch {
        setVersoes([]);
      } finally {
        setCarregandoVersoes(false);
      }
    }
  }, [doc.id, mostrarVersoes, versoes]);

  const isXml = doc.fileType === 'XML';

  return (
    <li className="group relative">
      <div
        className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 transition-colors
          ${modoSelecao && selecionado
            ? 'bg-primary/10 dark:bg-primary/20'
            : 'hover:bg-slate-50 dark:hover:bg-gray-800'
          }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Checkbox de seleção */}
        {modoSelecao && (
          <button
            type="button"
            onClick={() => onToggle?.(doc.id)}
            aria-label={selecionado ? `Desmarcar ${doc.fileName}` : `Selecionar ${doc.fileName}`}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 text-primary hover:text-primary-dark transition-colors"
          >
            {selecionado ? <CheckSquare size={18} /> : <Square size={18} />}
          </button>
        )}

        {/* Ícone de tipo */}
        <FileIcon type={doc.fileType} />

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate max-w-[240px] sm:max-w-none">
              {doc.fileName}
            </span>

            {!doc.readStatus && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold
                               bg-primary text-white leading-none tracking-wide animate-pulse">
                NOVO
              </span>
            )}

            {doc.categoria ? (
              <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COR_CATEGORIA[doc.categoria as CategoriaFiltro] ?? 'bg-gray-100 text-gray-600'}`}>
                {LABEL_CATEGORIA[doc.categoria as CategoriaFiltro] ?? doc.categoria}
              </span>
            ) : doc.sector ? (
              <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COR_SETOR[doc.sector as SetorFiltro] ?? 'bg-gray-100 text-gray-600'}`}>
                {LABEL_SETOR[doc.sector as SetorFiltro] ?? doc.sector}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {doc.competencia && (
              <span className="text-xs text-slate-500 dark:text-gray-400">
                Competência: <span className="font-medium">{formatarCompetencia(doc.competencia)}</span>
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-gray-400">
              Enviado em <span className="font-medium">{formatarData(doc.createdAt)}</span>
            </span>
            <span className="text-xs text-slate-400 dark:text-gray-500 hidden sm:inline">
              {formatarTamanho(doc.fileSizeBytes)}
            </span>
          </div>

          {erro && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle size={11} />
              {erro}
            </p>
          )}
        </div>
        </div>

        <div className="flex items-center gap-1 sm:shrink-0 self-end sm:self-auto">
        {/* Botão expandir NF-e (apenas XMLs) */}
        {isXml && (
          <button
            type="button"
            onClick={handleExpandir}
            title="Ver dados extraídos da NF-e"
            aria-label="Ver dados extraídos da NF-e"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors shrink-0"
          >
            {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}

        {/* Botão histórico de versões */}
        <button
          type="button"
          onClick={handleVerVersoes}
          title="Histórico de versões"
          aria-label="Histórico de versões"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors shrink-0"
        >
          <History size={15} />
        </button>

        {/* Botão de download */}
        <button
          type="button"
          onClick={handleBaixar}
          disabled={baixando}
          aria-label={`Baixar ${doc.fileName}`}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-lg text-xs font-semibold
                     bg-primary hover:brightness-90 text-white transition-all shrink-0
                     disabled:opacity-60 disabled:cursor-not-allowed
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {baixando
            ? <Loader2 size={13} className="animate-spin" />
            : <Download size={13} />
          }
          <span className="hidden sm:inline">{baixando ? 'Aguarde…' : 'Baixar'}</span>
        </button>
        </div>

      </div>

      {/* Painel de dados NF-e */}
      {isXml && expandido && (
        <div className="px-4 pb-3 bg-amber-50/50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900/30">
          {carregandoMeta ? (
            <p className="text-xs text-slate-400 py-2 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> Carregando dados da NF-e…
            </p>
          ) : metadata && Object.keys(metadata).length > 0 ? (
            <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
              {(metadata as { emitenteNome?: string }).emitenteNome && (
                <div className="col-span-2 sm:col-span-1 text-xs"><span className="text-slate-500">Emitente: </span><span className="font-medium">{(metadata as { emitenteNome: string }).emitenteNome}</span></div>
              )}
              {(metadata as { destinatarioNome?: string }).destinatarioNome && (
                <div className="col-span-2 sm:col-span-1 text-xs"><span className="text-slate-500">Destinatário: </span><span className="font-medium">{(metadata as { destinatarioNome: string }).destinatarioNome}</span></div>
              )}
              {(metadata as { numero?: string }).numero && (
                <div className="text-xs"><span className="text-slate-500">Nº NF-e: </span><span className="font-medium">{(metadata as { numero: string }).numero}</span></div>
              )}
              {(metadata as { valorTotal?: number }).valorTotal && (
                <div className="text-xs"><span className="text-slate-500">Valor: </span><span className="font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((metadata as { valorTotal: number }).valorTotal)}</span></div>
              )}
              {(metadata as { cfop?: string }).cfop && (
                <div className="text-xs"><span className="text-slate-500">CFOP: </span><span className="font-medium">{(metadata as { cfop: string }).cfop}</span></div>
              )}
              {(metadata as { dataEmissao?: string }).dataEmissao && (
                <div className="text-xs"><span className="text-slate-500">Emissão: </span><span className="font-medium">{new Date((metadata as { dataEmissao: string }).dataEmissao).toLocaleDateString('pt-BR')}</span></div>
              )}
              {(metadata as { chaveAcesso?: string }).chaveAcesso && (
                <div className="col-span-2 sm:col-span-3 text-xs"><span className="text-slate-500">Chave: </span><span className="font-mono text-[10px] break-all">{(metadata as { chaveAcesso: string }).chaveAcesso}</span></div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-2">Dados ainda não extraídos. O processamento ocorre em segundos após o upload.</p>
          )}
        </div>
      )}

      {/* Painel de histórico de versões */}
      {mostrarVersoes && (
        <div className="px-4 pb-3 bg-slate-50/50 dark:bg-gray-800/30 border-t border-slate-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 pt-2 mb-2">Histórico de Versões</p>
          {carregandoVersoes ? (
            <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando…</p>
          ) : versoes && versoes.length > 0 ? (
            <div className="space-y-1.5">
              {versoes.map((v, idx) => (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700 dark:text-gray-300">v{v.versao}</span>
                    {idx === 0 && <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">Atual</span>}
                    <span className="text-slate-400">{new Date(v.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <a
                    href={`/api/v1/documentos/${doc.id}/versoes/${v.versao}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs flex items-center gap-1"
                  >
                    <Download size={11} /> Baixar
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Apenas 1 versão disponível.</p>
          )}
        </div>
      )}
    </li>
  );
}

// =============================================================================
// Sub-componente: Paginação
// =============================================================================

interface PaginacaoProps {
  page:            number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
  total:           number;
  onMudar:         (p: number) => void;
}

function Paginacao({
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  total,
  onMudar,
}: PaginacaoProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-gray-700">
      <span className="text-xs text-slate-500 dark:text-gray-400">
        {total} documento{total !== 1 ? 's' : ''} &mdash; página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMudar(page - 1)}
          disabled={!hasPreviousPage}
          aria-label="Página anterior"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-700
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onMudar(page + 1)}
          disabled={!hasNextPage}
          aria-label="Próxima página"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-700
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// DocumentosTable — Componente principal
//
// UX mobile-first: cada documento é uma linha compacta com o botão de download
// destacado à direita. As informações secundárias (tamanho) são ocultadas
// em telas pequenas para não sobrecarregar o layout.
//
// O badge "NOVO" é controlado por `doc.readStatus`:
//   false = não lido = exibe badge azul
//   true  = lido = sem badge (optimistic update remove imediatamente ao baixar)
// =============================================================================

export function DocumentosTable({
  documentos,
  carregando,
  erro,
  total,
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  setor,
  categoria,
  baixandoIds,
  onMudarSetor,
  onMudarCategoria,
  onMudarPagina,
  onBaixar,
  onBaixarLote,
}: DocumentosTableProps) {
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [baixandoLote, setBaixandoLote] = useState(false);

  const toggleSelecao = useCallback((id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const sairModoSelecao = useCallback(() => {
    setModoSelecao(false);
    setSelecionados(new Set());
  }, []);

  const handleBaixarLote = useCallback(async () => {
    const ids = [...selecionados];
    if (ids.length === 0) return;

    setBaixandoLote(true);
    try {
      if (onBaixarLote) {
        await onBaixarLote(ids);
      } else {
        // Implementação padrão: POST → blob → download
        const res = await fetch('/api/v1/documentos/download-lote', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ids }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message ?? 'Falha ao gerar ZIP.');
        }

        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'documentos.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      sairModoSelecao();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao baixar documentos.');
    } finally {
      setBaixandoLote(false);
    }
  }, [selecionados, onBaixarLote, sairModoSelecao]);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">

      {/* ------------------------------------------------------------------ */}
      {/* Abas de categoria + botão de seleção                                */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex overflow-x-auto border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-10"
        role="tablist"
        aria-label="Filtrar por categoria"
      >
        {ABAS.map(({ label, valor, cor }) => {
          const ativo = categoria === valor;
          return (
            <button
              key={valor ?? 'todos'}
              role="tab"
              aria-selected={ativo}
              onClick={() => onMudarCategoria(valor)}
              className={`
                flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset
                focus-visible:ring-primary
                ${ativo
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 hover:border-slate-300 dark:hover:border-gray-600'
                }
              `}
            >
              {ativo && valor && (
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${cor}`} aria-hidden="true" />
              )}
              {label}
            </button>
          );
        })}

        {/* Separador + botão Selecionar */}
        <div className="flex items-center ml-auto px-3 shrink-0">
          {modoSelecao ? (
            <button
              type="button"
              onClick={sairModoSelecao}
              title="Cancelar seleção"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300
                         hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
            >
              <X size={13} />
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModoSelecao(true)}
              title="Selecionar documentos para download em lote"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300
                         hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors"
            >
              <CheckSquare size={13} />
              Selecionar
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Estados: erro / carregando / vazio / lista                           */}
      {/* ------------------------------------------------------------------ */}

      {erro ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center px-4">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">Falha ao carregar documentos</p>
          <p className="text-xs text-slate-500 dark:text-gray-400">{erro.message}</p>
        </div>
      ) : carregando ? (
        <div className="py-12 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Carregando documentos…</p>
        </div>
      ) : documentos.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center px-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 dark:bg-gray-800">
            <FolderOpen size={24} className="text-slate-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
            {categoria
              ? `Nenhum documento em ${ABAS.find(a => a.valor === categoria)?.label ?? categoria}`
              : 'Nenhum documento disponível'
            }
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-400 max-w-xs">
            Quando o contador enviar documentos para você, eles aparecerão aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Cabeçalho sumário */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
              {total} documento{total !== 1 ? 's' : ''}
            </span>
            {modoSelecao && (
              <span className="text-xs text-slate-400 dark:text-gray-500">
                {selecionados.size > 0
                  ? `${selecionados.size} selecionado${selecionados.size !== 1 ? 's' : ''}`
                  : 'Clique para selecionar'
                }
              </span>
            )}
          </div>

          {/* Lista */}
          <ul
            role="list"
            aria-label="Lista de documentos"
            className="divide-y divide-slate-100 dark:divide-gray-700"
          >
            {documentos.map((doc) => (
              <DocumentoLinha
                key={doc.id}
                doc={doc}
                baixando={baixandoIds.has(doc.id)}
                onBaixar={onBaixar}
                modoSelecao={modoSelecao}
                selecionado={selecionados.has(doc.id)}
                onToggle={toggleSelecao}
              />
            ))}
          </ul>

          {/* Paginação */}
          <Paginacao
            page={page}
            totalPages={totalPages}
            hasPreviousPage={hasPreviousPage}
            hasNextPage={hasNextPage}
            total={total}
            onMudar={onMudarPagina}
          />

          {/* Barra flutuante de ação em lote */}
          {modoSelecao && selecionados.size > 0 && (
            <div className="sticky bottom-4 mx-4 mb-4 mt-2 z-20">
              <div className="flex items-center justify-between gap-3 px-4 py-3
                              bg-slate-800 dark:bg-gray-950 text-white rounded-xl shadow-xl
                              border border-slate-700 dark:border-gray-800">
                <span className="text-sm font-medium flex items-center gap-2">
                  <PackageOpen size={16} className="text-primary-light shrink-0" />
                  {selecionados.size} arquivo{selecionados.size !== 1 ? 's' : ''} selecionado{selecionados.size !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={sairModoSelecao}
                    disabled={baixandoLote}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold
                               bg-slate-700 hover:bg-slate-600 transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleBaixarLote}
                    disabled={baixandoLote}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                               bg-primary hover:brightness-90 transition-colors
                               disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {baixandoLote
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Download size={13} />
                    }
                    {baixandoLote ? 'Gerando ZIP…' : 'Baixar ZIP'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
