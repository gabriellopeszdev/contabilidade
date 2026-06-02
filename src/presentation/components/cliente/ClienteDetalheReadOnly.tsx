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
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

type SetorTipo   = 'FISCAL' | 'PESSOAL' | 'CONTABIL' | 'TODOS';
type SetorDocumento = SetorTipo | null;
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
  sector:        SetorDocumento;
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
// Fetcher
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

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iniciais(nome: string): string {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

const SETOR_CONFIG: Record<SetorTipo, { label: string; classes: string }> = {
  FISCAL:   { label: 'Fiscal',   classes: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' },
  PESSOAL:  { label: 'Pessoal',  classes: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800' },
  CONTABIL: { label: 'Contábil', classes: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800' },
  TODOS:    { label: 'Todos',    classes: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
};

const SETOR_DEFAULT_CONFIG = {
  label: 'A categorizar',
  classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
};

function getSetorConfig(setor: SetorDocumento) {
  return setor ? SETOR_CONFIG[setor] : SETOR_DEFAULT_CONFIG;
}

const ORIGEM_CONFIG: Record<Origem, { label: string; icone: typeof Upload; classes: string }> = {
  UPLOAD_CLIENTE:  { label: 'Enviado pelo cliente',    icone: Upload,   classes: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' },
  UPLOAD_CONTADOR: { label: 'Enviado pelo escritório', icone: Download, classes: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' },
};

// =============================================================================
// ClienteDetalheReadOnly — Prontuário do cliente (somente leitura)
//
// O funcionário pode visualizar informações do cliente e baixar documentos
// dos setores que tem acesso. Sem ações de edição/exclusão.
// =============================================================================

export function ClienteDetalheReadOnly() {
  const params = useParams();
  const router = useRouter();
  const { token, usuario } = useAuth();
  const clienteId = params.id as string;

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroSetor, setFiltroSetor] = useState<SetorTipo | ''>('');
  const [filtroLeitura, setFiltroLeitura] = useState<'lido' | 'nao_lido' | ''>('');
  const [filtroOrigem, setFiltroOrigem] = useState<Origem | ''>('');

  // Download
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  const apiUrl = useMemo(() => {
    const base = `/api/v1/clientes/${clienteId}/documentos`;
    const qp = new URLSearchParams();
    if (filtroSetor) qp.set('setor', filtroSetor);
    if (filtroLeitura) qp.set('statusLeitura', filtroLeitura);
    const qs = qp.toString();
    return qs ? `${base}?${qs}` : base;
  }, [clienteId, filtroSetor, filtroLeitura]);

  const swrKey: [string, string] | null = token ? [apiUrl, token] : null;
  const { data, error, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const cliente    = data?.cliente;
  const resumo     = data?.resumo;
  const documentos = data?.documentos ?? [];

  const docsFiltrados = documentos.filter((d) => {
    if (busca.trim() && !d.fileName.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroOrigem && d.origem !== filtroOrigem) return false;
    return true;
  });

  // Download handler
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

      const { url, nomeArquivo } = await res.json();
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
    } catch {
      alert('Erro de conexão ao baixar o arquivo.');
    } finally {
      setBaixandoId(null);
    }
  }

  const setoresLabel = usuario?.setores?.length
    ? usuario.setores.join(', ')
    : 'seus setores';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      {/* Voltar + Cabeçalho */}
      <div>
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400
            transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Voltar para Clientes
        </Link>

        {/* Banner read-only */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-3 mb-4">
          <ShieldCheck size={18} className="text-blue-500 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Modo visualização — documentos filtrados por {setoresLabel}.
          </p>
        </div>

        {isLoading && !cliente ? (
          <div className="h-20 flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-blue-500" />
            <span className="text-sm text-slate-500 dark:text-gray-400">Carregando prontuário…</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">Erro ao carregar</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error.message}</p>
            </div>
          </div>
        ) : cliente ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400
                flex items-center justify-center text-lg font-bold">
                {iniciais(cliente.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-slate-900 dark:text-gray-100 truncate">{cliente.nome}</h1>
                <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-slate-500 dark:text-gray-400">
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
              {resumo && (
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="text-center px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{resumo.pendentes}</p>
                    <p className="text-[10px] font-medium text-amber-600 dark:text-amber-500 uppercase tracking-wide">Pendentes</p>
                  </div>
                  <div className="text-center px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{resumo.lidos}</p>
                    <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-500 uppercase tracking-wide">Lidos</p>
                  </div>
                  <div className="text-center px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
                    <p className="text-lg font-bold text-slate-700 dark:text-gray-200">{resumo.total}</p>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
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
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800
              text-slate-900 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value as SetorTipo | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800
              text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]"
          >
            <option value="">Todos os Setores</option>
            <option value="FISCAL">Fiscal</option>
            <option value="PESSOAL">Pessoal</option>
            <option value="CONTABIL">Contábil</option>
          </select>
          <select
            value={filtroLeitura}
            onChange={(e) => setFiltroLeitura(e.target.value as 'lido' | 'nao_lido' | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800
              text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]"
          >
            <option value="">Todos</option>
            <option value="nao_lido">Não lidos</option>
            <option value="lido">Lidos</option>
          </select>
          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem(e.target.value as Origem | '')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800
              text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]"
          >
            <option value="">Todas as Origens</option>
            <option value="UPLOAD_CLIENTE">Enviado pelo Cliente</option>
            <option value="UPLOAD_CONTADOR">Enviado pelo Escritório</option>
          </select>
        </div>
      </div>

      {/* Lista de Documentos */}
      {isLoading && documentos.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <p className="text-sm text-slate-500 dark:text-gray-400">Carregando documentos…</p>
        </div>
      ) : docsFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <FileText size={28} className="text-slate-300 dark:text-gray-600" />
          <p className="text-sm font-semibold text-slate-600 dark:text-gray-300">Nenhum documento encontrado</p>
          <p className="text-xs text-slate-400 dark:text-gray-500 max-w-xs">
            {busca.trim() || filtroSetor || filtroLeitura || filtroOrigem
              ? 'Tente ajustar os filtros.'
              : 'Este cliente ainda não possui documentos nos seus setores.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-[1fr_100px_90px_100px_140px_150px_60px] gap-3 px-5 py-3
            border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">
            <span>Documento</span>
            <span>Setor</span>
            <span>Tipo</span>
            <span>Tamanho</span>
            <span>Origem</span>
            <span>Leitura</span>
            <span className="text-center">Baixar</span>
          </div>

          <ul role="list" className="divide-y divide-slate-100 dark:divide-gray-700">
            {docsFiltrados.map((doc) => {
              const origemCfg = ORIGEM_CONFIG[doc.origem];
              const setorCfg  = getSetorConfig(doc.sector);
              const OrigemIcone = origemCfg.icone;

              return (
                <li key={doc.id} className="group">
                  <div className="lg:grid lg:grid-cols-[1fr_100px_90px_100px_140px_150px_60px] gap-3 items-center
                    px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">

                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${origemCfg.classes}`}>
                        <OrigemIcone size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate" title={doc.fileName}>
                          {doc.fileName}
                        </p>
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
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                            : 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                        }`}>
                        {doc.fileType}
                      </span>
                    </div>

                    <span className="text-xs text-slate-500 dark:text-gray-400 mt-1 lg:mt-0">
                      {formatarTamanho(doc.fileSizeBytes)}
                    </span>

                    <div className="mt-1 lg:mt-0">
                      <span className="text-xs text-slate-500 dark:text-gray-400">
                        {doc.origem === 'UPLOAD_CLIENTE' ? 'Cliente' : 'Escritório'}
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
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Não lido</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 lg:mt-0 flex justify-center">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={baixandoId === doc.id}
                        title="Baixar arquivo"
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20
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

          <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800">
            <span className="text-xs text-slate-500 dark:text-gray-400">
              {docsFiltrados.length} documento{docsFiltrados.length !== 1 ? 's' : ''}
              {busca.trim() || filtroSetor || filtroLeitura || filtroOrigem ? ' (filtrado)' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
