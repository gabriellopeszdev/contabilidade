'use client';

import { useState, useCallback } from 'react';
import {
  FileText,
  FileCode2,
  Download,
  Loader2,
  AlertCircle,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import type {
  DocumentoClienteDTO,
  SetorFiltro,
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
  baixandoIds:     Set<string>;
  onMudarSetor:    (s: SetorFiltro | undefined) => void;
  onMudarPagina:   (p: number) => void;
  onBaixar:        (id: string) => Promise<void>;
}

// =============================================================================
// Configuração das abas
// =============================================================================

interface ConfigAba {
  label: string;
  valor: SetorFiltro | undefined;
  cor:   string;
}

const ABAS: ConfigAba[] = [
  { label: 'Todos',    valor: undefined,   cor: 'bg-slate-100 text-slate-700'  },
  { label: 'Fiscal',   valor: 'FISCAL',    cor: 'bg-blue-100 text-blue-700'    },
  { label: 'Pessoal',  valor: 'PESSOAL',   cor: 'bg-violet-100 text-violet-700'},
  { label: 'Contábil', valor: 'CONTABIL',  cor: 'bg-emerald-100 text-emerald-700'},
];

const COR_SETOR: Record<SetorFiltro, string> = {
  FISCAL:   'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800',
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

function FileIcon({ type }: { type: 'XML' | 'PDF' }) {
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
  doc:        DocumentoClienteDTO;
  baixando:   boolean;
  onBaixar:   (id: string) => Promise<void>;
}

function DocumentoLinha({ doc, baixando, onBaixar }: DocumentoLinhaProps) {
  const [erro, setErro] = useState<string | null>(null);

  const handleBaixar = useCallback(async () => {
    setErro(null);
    try {
      await onBaixar(doc.id);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Falha ao baixar. Tente novamente.',
      );
      // Limpa o erro após 5s
      setTimeout(() => setErro(null), 5_000);
    }
  }, [doc.id, onBaixar]);

  return (
    <li className="group relative">
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">

        {/* Ícone de tipo */}
        <FileIcon type={doc.fileType} />

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate max-w-[240px] sm:max-w-none">
              {doc.fileName}
            </span>

            {/* Badge "Novo" — visível apenas quando readStatus === false */}
            {!doc.readStatus && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold
                               bg-blue-500 text-white leading-none tracking-wide animate-pulse">
                NOVO
              </span>
            )}

            {/* Badge de setor (em mobile: segunda linha; em sm+: inline) */}
            <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COR_SETOR[doc.sector as SetorFiltro] ?? 'bg-gray-100 text-gray-600'}`}>
              {LABEL_SETOR[doc.sector as SetorFiltro] ?? doc.sector}
            </span>
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

          {/* Erro inline */}
          {erro && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle size={11} />
              {erro}
            </p>
          )}
        </div>

        {/* Botão de download */}
        <button
          type="button"
          onClick={handleBaixar}
          disabled={baixando}
          aria-label={`Baixar ${doc.fileName}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
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
          className="p-1.5 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-700
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onMudar(page + 1)}
          disabled={!hasNextPage}
          aria-label="Próxima página"
          className="p-1.5 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-slate-100 dark:hover:bg-gray-700
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
  baixandoIds,
  onMudarSetor,
  onMudarPagina,
  onBaixar,
}: DocumentosTableProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">

      {/* ------------------------------------------------------------------ */}
      {/* Abas de setor                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex overflow-x-auto border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-10"
        role="tablist"
        aria-label="Filtrar por setor"
      >
        {ABAS.map(({ label, valor, cor }) => {
          const ativo = setor === valor;
          return (
            <button
              key={valor ?? 'todos'}
              role="tab"
              aria-selected={ativo}
              onClick={() => onMudarSetor(valor)}
              className={`
                flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset
                focus-visible:ring-blue-500
                ${ativo
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
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
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Carregando documentos…</p>
        </div>
      ) : documentos.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center px-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 dark:bg-gray-800">
            <FolderOpen size={24} className="text-slate-400 dark:text-gray-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
            {setor
              ? `Nenhum documento no setor ${LABEL_SETOR[setor]}`
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
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
              {total} documento{total !== 1 ? 's' : ''}
            </span>
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
        </>
      )}

    </div>
  );
}
