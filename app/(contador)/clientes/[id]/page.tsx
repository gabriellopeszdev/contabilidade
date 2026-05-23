'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Search,
  FileText,
  Eye,
  EyeOff,
  Upload,
  Download,
  Clock,
  Loader2,
  AlertCircle,
  Filter,
  CheckCircle2,
} from 'lucide-react';

import { useAuth } from '../../../../src/presentation/hooks/useAuth';
import { ClienteDetalheReadOnly } from '../../../../src/presentation/components/cliente/ClienteDetalheReadOnly';

// =============================================================================
// Tipos
// =============================================================================

type SetorTipo   = 'FISCAL' | 'PESSOAL' | 'CONTABIL';
type Origem      = 'UPLOAD_CLIENTE' | 'UPLOAD_CONTADOR';

interface ClienteInfo {
  id:    string;
  nome:  string;
  email: string;
  cnpj:  string;
  phone: string | null;
}

interface Resumo {
  total:     number;
  lidos:     number;
  pendentes: number;
}

interface DocumentoDTO {
  id:            string;
  fileName:      string;
  fileType:      'XML' | 'PDF';
  sector:        SetorTipo;
  fileSizeBytes: number;
  readStatus:    boolean;
  readAt:        string | null;
  competencia:   string | null;
  createdAt:     string;
  origem:        Origem;
  uploaderNome:  string;
}

interface HistoricoResponse {
  cliente:    ClienteInfo;
  resumo:     Resumo;
  documentos: DocumentoDTO[];
}

// =============================================================================
// Fetcher autenticado
// =============================================================================

async function fetcher([url, token]: [string, string]): Promise<HistoricoResponse> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 401) throw new Error('Sessão expirada.');
  if (res.status === 403) throw new Error('Sem permissão para visualizar este cliente.');
  if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
  return res.json() as Promise<HistoricoResponse>;
}

// =============================================================================
// Helpers
// =============================================================================

function formatarCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iniciais(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

const SETOR_CONFIG: Record<SetorTipo, { label: string; classes: string }> = {
  FISCAL:   { label: 'Fiscal',   classes: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  PESSOAL:  { label: 'Pessoal',  classes: 'bg-pink-100   text-pink-700   border-pink-200' },
  CONTABIL: { label: 'Contábil', classes: 'bg-teal-100   text-teal-700   border-teal-200' },
};

const ORIGEM_CONFIG: Record<Origem, { label: string; icone: typeof Upload; classes: string }> = {
  UPLOAD_CLIENTE:  { label: 'Enviado pelo cliente',  icone: Upload,   classes: 'text-blue-600   bg-blue-50' },
  UPLOAD_CONTADOR: { label: 'Enviado pelo escritório', icone: Download, classes: 'text-emerald-600 bg-emerald-50' },
};

// =============================================================================
// Página: /(contador)/clientes/[id] — Prontuário Digital do Cliente
// =============================================================================

export default function ClienteDetalhesPage() {
  const { isFuncionarioEscritorio } = useAuth();

  if (isFuncionarioEscritorio) {
    return <ClienteDetalheReadOnly />;
  }

  return <ClienteDetalhesPageDono />;
}

function ClienteDetalhesPageDono() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const clienteId = params.id as string;

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroSetor, setFiltroSetor] = useState<SetorTipo | ''>('');
  const [filtroLeitura, setFiltroLeitura] = useState<'lido' | 'nao_lido' | ''>('');
  const [filtroOrigem, setFiltroOrigem] = useState<Origem | ''>('');

  // Download
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  // Monta URL com query params
  const apiUrl = useMemo(() => {
    const base = `/api/v1/clientes/${clienteId}/documentos`;
    const qp = new URLSearchParams();
    if (filtroSetor) qp.set('setor', filtroSetor);
    if (filtroLeitura) qp.set('statusLeitura', filtroLeitura);
    const qs = qp.toString();
    return qs ? `${base}?${qs}` : base;
  }, [clienteId, filtroSetor, filtroLeitura]);

  const swrKey: [string, string] | null = token ? [apiUrl, token] : null;
  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const cliente    = data?.cliente;
  const resumo     = data?.resumo;
  const documentos = data?.documentos ?? [];

  // Filtros locais (busca + origem)
  const docsFiltrados = documentos.filter((d) => {
    if (busca.trim() && !d.fileName.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroOrigem && d.origem !== filtroOrigem) return false;
    return true;
  });

  // ---------------------------------------------------------------------------
  // Download handler
  // ---------------------------------------------------------------------------
  async function handleDownload(doc: DocumentoDTO) {
    if (!token || baixandoId) return;
    setBaixandoId(doc.id);

    try {
      const res = await fetch(`/api/v1/documentos/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.message ?? `Erro ao baixar: HTTP ${res.status}`);
        return;
      }

      const { url, primeiraLeitura, nomeArquivo } = await res.json();

      // Baixar via presigned URL do MinIO
      const fileRes = await fetch(url);
      if (!fileRes.ok) {
        alert('Falha ao baixar o arquivo do storage.');
        return;
      }

      const blob = await fileRes.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = nomeArquivo ?? doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      // Se foi a primeira leitura (doc do cliente marcado como lido), revalida tabela
      if (primeiraLeitura) {
        mutate();
      }
    } catch (err) {
      alert('Erro de conexão ao baixar o arquivo.');
    } finally {
      setBaixandoId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      {/* ------------------------------------------------------------------ */}
      {/* Voltar + Cabeçalho do Cliente                                        */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600
            transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Voltar para Clientes
        </Link>

        {isLoading && !cliente ? (
          <div className="h-20 flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-blue-500" />
            <span className="text-sm text-slate-500">Carregando prontuário…</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">Erro ao carregar</p>
              <p className="text-xs text-red-600 mt-0.5">{error.message}</p>
            </div>
          </div>
        ) : cliente ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Avatar */}
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-blue-100 text-blue-700
                flex items-center justify-center text-lg font-bold">
                {iniciais(cliente.nome)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-slate-900 truncate">{cliente.nome}</h1>
                <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Building2 size={12} /> {formatarCNPJ(cliente.cnpj)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail size={12} /> {cliente.email}
                  </span>
                  {cliente.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {cliente.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Resumo */}
              {resumo && (
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="text-center px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-lg font-bold text-amber-700">{resumo.pendentes}</p>
                    <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Pendentes</p>
                  </div>
                  <div className="text-center px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <p className="text-lg font-bold text-emerald-700">{resumo.lidos}</p>
                    <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide">Lidos</p>
                  </div>
                  <div className="text-center px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-lg font-bold text-slate-700">{resumo.total}</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Total</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filtros                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Busca por arquivo */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do arquivo…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 bg-white
              text-slate-900 placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400" />

          {/* Filtro Setor */}
          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value as SetorTipo | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white
              text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Setores</option>
            <option value="FISCAL">Fiscal</option>
            <option value="PESSOAL">Pessoal</option>
            <option value="CONTABIL">Contábil</option>
          </select>

          {/* Filtro Leitura */}
          <select
            value={filtroLeitura}
            onChange={(e) => setFiltroLeitura(e.target.value as 'lido' | 'nao_lido' | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white
              text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="nao_lido">Não lidos</option>
            <option value="lido">Lidos</option>
          </select>

          {/* Filtro Origem */}
          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem(e.target.value as Origem | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white
              text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as Origens</option>
            <option value="UPLOAD_CLIENTE">Enviado pelo Cliente</option>
            <option value="UPLOAD_CONTADOR">Enviado pelo Escritório</option>
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Lista / Linha do Tempo dos Documentos                                */}
      {/* ------------------------------------------------------------------ */}
      {isLoading && documentos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <p className="text-sm text-slate-500">Carregando documentos…</p>
        </div>
      ) : docsFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <FileText size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">Nenhum documento encontrado</p>
          <p className="text-xs text-slate-400 max-w-xs">
            {busca.trim() || filtroSetor || filtroLeitura || filtroOrigem
              ? 'Tente ajustar os filtros.'
              : 'Este cliente ainda não possui documentos.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_100px_90px_100px_140px_150px_60px] gap-3 px-5 py-3
            border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <span>Documento</span>
            <span>Setor</span>
            <span>Tipo</span>
            <span>Tamanho</span>
            <span>Origem</span>
            <span>Leitura</span>
            <span className="text-center">Ações</span>
          </div>

          {/* Linhas */}
          <ul role="list" className="divide-y divide-slate-100">
            {docsFiltrados.map((doc) => {
              const origemCfg = ORIGEM_CONFIG[doc.origem];
              const setorCfg  = SETOR_CONFIG[doc.sector];
              const OrigemIcone = origemCfg.icone;

              return (
                <li key={doc.id} className="group">
                  <div className="lg:grid lg:grid-cols-[1fr_100px_90px_100px_140px_150px_60px] gap-3 items-center
                    px-5 py-4 hover:bg-slate-50 transition-colors">

                    {/* Documento: ícone de origem + nome + data */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${origemCfg.classes}`}>
                        <OrigemIcone size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate" title={doc.fileName}>
                          {doc.fileName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                          <Clock size={10} />
                          <span>{formatarDataHora(doc.createdAt)}</span>
                          <span className="text-slate-300">·</span>
                          <span>por {doc.uploaderNome}</span>
                        </div>
                      </div>
                    </div>

                    {/* Setor */}
                    <div className="mt-2 lg:mt-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px]
                        font-bold uppercase tracking-wide border ${setorCfg.classes}`}>
                        {setorCfg.label}
                      </span>
                    </div>

                    {/* Tipo */}
                    <div className="mt-1 lg:mt-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px]
                        font-bold uppercase border ${
                          doc.fileType === 'PDF'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-sky-50 text-sky-600 border-sky-200'
                        }`}>
                        {doc.fileType}
                      </span>
                    </div>

                    {/* Tamanho */}
                    <span className="text-xs text-slate-500 mt-1 lg:mt-0">
                      {formatarTamanho(doc.fileSizeBytes)}
                    </span>

                    {/* Origem */}
                    <div className="mt-1 lg:mt-0">
                      <span className="text-xs text-slate-500">
                        {doc.origem === 'UPLOAD_CLIENTE' ? 'Cliente' : 'Escritório'}
                      </span>
                    </div>

                    {/* Status de Leitura */}
                    <div className="mt-2 lg:mt-0">
                      {doc.readStatus ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-emerald-700">Lido</p>
                            {doc.readAt && (
                              <p className="text-[10px] text-slate-400">
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

                    {/* Download */}
                    <div className="mt-2 lg:mt-0 flex justify-center">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={baixandoId === doc.id}
                        title="Baixar arquivo"
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {baixandoId === doc.id ? (
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

          {/* Rodapé */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-500">
              {docsFiltrados.length} documento{docsFiltrados.length !== 1 ? 's' : ''}
              {busca.trim() || filtroSetor || filtroLeitura || filtroOrigem ? ' (filtrado)' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
