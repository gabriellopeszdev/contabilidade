'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  EyeOff,
  Upload,
  Download,
  Clock,
  Loader2,
  AlertCircle,
  Filter,
  CheckCircle2,
  PenLine,
  Copy,
  X,
  ExternalLink,
  Sparkles,
  Info,
  Bot,
  MessageSquare,
  Send,
  Lock,
  TrendingUp,
  Users,
} from 'lucide-react';

import { toast } from 'sonner';

import { useAuth }       from '../../../../src/presentation/hooks/useAuth';
import { usePlanoAtual } from '../../../../src/presentation/hooks/usePlanoAtual';
import { ClienteDetalheReadOnly } from '../../../../src/presentation/components/cliente/ClienteDetalheReadOnly';

// =============================================================================
// Tipos
// =============================================================================

type SetorTipo   = 'FISCAL' | 'PESSOAL' | 'CONTABIL' | 'TODOS';
type SetorDocumento = SetorTipo | null;
type SetorClassificavel = 'FISCAL' | 'PESSOAL' | 'CONTABIL';
type Origem      = 'UPLOAD_CLIENTE' | 'UPLOAD_CONTADOR';

interface ClienteInfo {
  id:               string;
  nome:             string;
  email:            string;
  cnpj:             string;
  phone:            string | null;
  cnae?:            string | null;
  regimeTributario?: string | null;
}

interface ObrigacaoSugerida {
  nome:             string;
  descricao?:       string;
  diaVencimento:    number;
  cor?:             string;
  recorrencia?:     string;
  mesesAplicacao:   number[];
  fundamentoLegal?: string;
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

interface FuncionarioSimples {
  id:   string;
  name: string;
}

interface DocumentoResponsaveisResponse {
  responsaveis: { id: string; name: string; assignedAt: string }[];
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
  TODOS:    { label: 'Todos',    classes: 'bg-slate-100  text-slate-700  border-slate-200' },
};

const SETOR_DEFAULT_CONFIG = {
  label: 'A categorizar',
  classes: 'bg-amber-100 text-amber-700 border-amber-200',
};

const SETOR_OPCOES: { value: SetorClassificavel; label: string; classes: string }[] = [
  { value: 'FISCAL', label: 'Fiscal', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
  { value: 'PESSOAL', label: 'Pessoal', classes: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100' },
  { value: 'CONTABIL', label: 'Contábil', classes: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100' },
];

function getSetorConfig(setor: SetorDocumento) {
  return setor ? SETOR_CONFIG[setor] : SETOR_DEFAULT_CONFIG;
}

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

  const { plan: planoAtual } = usePlanoAtual(token);
  const iaDisponivel = planoAtual ? planoAtual.features.includes('ia') : null; // null = ainda carregando

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroSetor, setFiltroSetor] = useState<SetorTipo | ''>('');
  const [filtroLeitura, setFiltroLeitura] = useState<'lido' | 'nao_lido' | ''>('');
  const [filtroOrigem, setFiltroOrigem] = useState<Origem | ''>('');

  // Download
  const [baixandoId, setBaixandoId] = useState<string | null>(null);

  // Responsáveis por documento
  const [responsaveisPopoverId, setResponsaveisPopoverId] = useState<string | null>(null);
  const [responsaveisPorDoc, setResponsaveisPorDoc] = useState<Record<string, string[]>>({});
  const [salvandoResponsaveis, setSalvandoResponsaveis] = useState(false);
  const responsaveisPopoverRef = useRef<HTMLDivElement>(null);

  // Fechar popover de responsáveis ao clicar fora
  useEffect(() => {
    if (!responsaveisPopoverId) return;
    const handler = (e: MouseEvent) => {
      if (!responsaveisPopoverRef.current?.contains(e.target as Node)) {
        setResponsaveisPopoverId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [responsaveisPopoverId]);

  // Assinatura
  const [assinandoId, setAssinandoId] = useState<string | null>(null);
  const [atualizandoSetorId, setAtualizandoSetorId] = useState<string | null>(null);
  const [documentoDetalheId, setDocumentoDetalheId] = useState<string | null>(null);

  // IA Fiscal
  const [iaCarregando, setIaCarregando] = useState(false);
  const [iaErro, setIaErro] = useState<string | null>(null);
  const [obrigacoesIa, setObrigacoesIa] = useState<ObrigacaoSugerida[] | null>(null);
  const [obrigacoesSelecionadas, setObrigacoesSelecionadas] = useState<Set<number>>(new Set());
  const [iaCriando, setIaCriando] = useState(false);
  const [modalAssinatura, setModalAssinatura] = useState<{ link: string; nomeDoc: string; expiresAt: string } | null>(null);
  const [copiadoLink, setCopiadoLink] = useState(false);

  // Chat por cliente
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatCarregando, setChatCarregando] = useState(false);
  const [chatErro, setChatErro] = useState<string | null>(null);
  const [chatBloqueado, setChatBloqueado] = useState(false);

  // Regime IA
  const [regimeIa, setRegimeIa] = useState<{
    regimeRecomendado: string;
    justificativa: string;
    vantagens: string[];
    desvantagens: string[];
    alertas: string[];
  } | null>(null);
  const [regimeCarregando, setRegimeCarregando] = useState(false);
  const [regimeErro, setRegimeErro] = useState<string | null>(null);
  const [regimeBloqueado, setRegimeBloqueado] = useState(false);

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

  // Busca lista de funcionários do escritório
  const { data: equipeData } = useSWR<{ funcionarios: FuncionarioSimples[] }>(
    token ? ['/api/v1/equipe', token] : null,
    ([url, tkn]: [string, string]) =>
      fetch(url, { headers: { Authorization: `Bearer ${tkn}` } }).then((r) =>
        r.ok ? (r.json() as Promise<{ funcionarios: FuncionarioSimples[] }>) : { funcionarios: [] },
      ),
    { revalidateOnFocus: false },
  );
  const funcionarios = equipeData?.funcionarios ?? [];

  // Carrega responsáveis de um documento ao abrir o popover
  const abrirResponsaveisPopover = useCallback(async (docId: string) => {
    setResponsaveisPopoverId(docId);
    if (responsaveisPorDoc[docId] !== undefined || !token) return;
    try {
      const res = await fetch(`/api/v1/documentos/${docId}/responsaveis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json() as DocumentoResponsaveisResponse;
        setResponsaveisPorDoc((prev) => ({ ...prev, [docId]: body.responsaveis.map((r) => r.id) }));
      }
    } catch { /* silencioso — popover continua aberto sem dados */ }
  }, [token, responsaveisPorDoc]);

  const toggleResponsavel = useCallback((docId: string, funcId: string) => {
    setResponsaveisPorDoc((prev) => {
      const atual = prev[docId] ?? [];
      return {
        ...prev,
        [docId]: atual.includes(funcId) ? atual.filter((id) => id !== funcId) : [...atual, funcId],
      };
    });
  }, []);

  const salvarResponsaveis = useCallback(async (docId: string) => {
    if (!token) return;
    setSalvandoResponsaveis(true);
    try {
      await fetch(`/api/v1/documentos/${docId}/responsaveis`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ funcionarioIds: responsaveisPorDoc[docId] ?? [] }),
      });
      setResponsaveisPopoverId(null);
    } catch { /* silencioso */ } finally {
      setSalvandoResponsaveis(false);
    }
  }, [token, responsaveisPorDoc]);

  const cliente    = data?.cliente;
  const resumo     = data?.resumo;
  const documentos = data?.documentos ?? [];
  const documentoDetalhe = documentoDetalheId
    ? documentos.find((doc) => doc.id === documentoDetalheId) ?? null
    : null;

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
        toast.error(body.message ?? `Erro ao baixar: HTTP ${res.status}`);
        return;
      }

      const { url, primeiraLeitura, nomeArquivo } = await res.json();

      // Baixar via presigned URL do MinIO
      const fileRes = await fetch(url);
      if (!fileRes.ok) {
        toast.error('Falha ao baixar o arquivo do storage.');
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
      toast.error('Erro de conexão ao baixar o arquivo.');
    } finally {
      setBaixandoId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Solicitar assinatura
  // ---------------------------------------------------------------------------
  async function handleSolicitarAssinatura(doc: DocumentoDTO) {
    if (!token || !clienteId || assinandoId) return;
    setAssinandoId(doc.id);

    try {
      const res = await fetch(`/api/v1/documentos/${doc.id}/assinatura`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatarioId: clienteId }),
      });

      const body = await res.json().catch(() => ({})) as { message?: string; linkAssinatura?: string; expiresAt?: string };

      if (!res.ok) {
        toast.error(body.message ?? `Erro ao solicitar assinatura: HTTP ${res.status}`);
        return;
      }

      setModalAssinatura({
        link: body.linkAssinatura ?? '',
        nomeDoc: doc.fileName,
        expiresAt: body.expiresAt ?? '',
      });
    } catch {
      toast.error('Erro de conexão ao solicitar assinatura.');
    } finally {
      setAssinandoId(null);
    }
  }

  async function copiarLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 2000);
  }

  // ---------------------------------------------------------------------------
  // Alterar setor/categoria do documento
  // ---------------------------------------------------------------------------
  async function handleAlterarSetor(doc: DocumentoDTO, novoSetor: SetorClassificavel): Promise<boolean> {
    if (!token || atualizandoSetorId) return false;
    if (doc.sector === novoSetor) return true;

    setAtualizandoSetorId(doc.id);
    try {
      const res = await fetch(`/api/v1/documentos/${doc.id}/setor`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sector: novoSetor }),
      });

      const body = await res.json().catch(() => ({})) as { message?: string };

      if (!res.ok) {
        toast.error(body.message ?? `Erro ao atualizar categoria: HTTP ${res.status}`);
        return false;
      }

      await mutate();
      return true;
    } catch {
      toast.error('Erro de conexão ao atualizar categoria.');
      return false;
    } finally {
      setAtualizandoSetorId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // IA Fiscal handlers
  // ---------------------------------------------------------------------------
  async function handleGerarObrigacoesIA() {
    if (!token) return;
    setIaCarregando(true);
    setIaErro(null);
    setObrigacoesIa(null);
    setObrigacoesSelecionadas(new Set());

    try {
      const res = await fetch(`/api/v1/clientes/${clienteId}/obrigacoes-ia`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      });

      const body = await res.json() as { obrigacoes?: ObrigacaoSugerida[]; message?: string };

      if (!res.ok) {
        setIaErro(body.message ?? `Erro HTTP ${res.status}`);
        return;
      }

      const lista = body.obrigacoes ?? [];
      setObrigacoesIa(lista);
      // Seleciona todas por padrão
      setObrigacoesSelecionadas(new Set(lista.map((_, i) => i)));
    } catch {
      setIaErro('Erro de conexão ao gerar obrigações. Tente novamente.');
    } finally {
      setIaCarregando(false);
    }
  }

  async function handleAdicionarAoCalendario() {
    if (!token || !obrigacoesIa) return;
    setIaCriando(true);
    setIaErro(null);

    const selecionadas = obrigacoesIa.filter((_, i) => obrigacoesSelecionadas.has(i));

    try {
      const res = await fetch(`/api/v1/clientes/${clienteId}/obrigacoes-ia`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ criar: true, obrigacoesSelecionadas: selecionadas }),
      });

      const body = await res.json() as { message?: string };

      if (!res.ok) {
        setIaErro(body.message ?? `Erro HTTP ${res.status}`);
        return;
      }

      // Reset após sucesso
      setObrigacoesIa(null);
      setObrigacoesSelecionadas(new Set());
      toast.success(`${selecionadas.length} obrigação(ões) adicionada(s) ao calendário fiscal com sucesso!`);
    } catch {
      setIaErro('Erro ao adicionar obrigações. Tente novamente.');
    } finally {
      setIaCriando(false);
    }
  }

  function toggleObrigacao(index: number) {
    setObrigacoesSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(index)) {
        novo.delete(index);
      } else {
        novo.add(index);
      }
      return novo;
    });
  }

  async function handleChatEnviar() {
    if (!token || !chatInput.trim() || chatCarregando) return;
    const userMsg = { role: 'user' as const, content: chatInput.trim() };
    const novasMensagens = [...chatMessages, userMsg];
    setChatMessages(novasMensagens);
    setChatInput('');
    setChatCarregando(true);
    setChatErro(null);

    try {
      const res = await fetch(`/api/v1/clientes/${clienteId}/chat`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: novasMensagens }),
      });
      const body = await res.json() as { reply?: string; message?: string };
      if (res.status === 403 && body.message?.includes('Enterprise')) {
        setChatBloqueado(true);
        return;
      }
      if (!res.ok) { setChatErro(body.message ?? `Erro HTTP ${res.status}`); return; }
      setChatMessages((prev) => [...prev, { role: 'assistant', content: body.reply ?? '' }]);
    } catch {
      setChatErro('Erro de conexão. Tente novamente.');
    } finally {
      setChatCarregando(false);
    }
  }

  async function handleAnalisarRegime() {
    if (!token) return;
    setRegimeCarregando(true);
    setRegimeErro(null);
    setRegimeIa(null);

    try {
      const res = await fetch(`/api/v1/clientes/${clienteId}/regime-ia`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const body = await res.json() as { regime?: typeof regimeIa; message?: string };
      if (res.status === 403 && body.message?.includes('Enterprise')) {
        setRegimeBloqueado(true);
        return;
      }
      if (!res.ok) { setRegimeErro(body.message ?? `Erro HTTP ${res.status}`); return; }
      setRegimeIa(body.regime ?? null);
    } catch {
      setRegimeErro('Erro de conexão. Tente novamente.');
    } finally {
      setRegimeCarregando(false);
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
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary/80
            transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Voltar para Clientes
        </Link>

        {isLoading && !cliente ? (
          <div className="h-20 flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Carregando prontuário…</span>
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Avatar */}
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-blue-100 text-blue-700
                flex items-center justify-center text-lg font-bold">
                {iniciais(cliente.nome)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{cliente.nome}</h1>
                <div className="flex items-center gap-4 mt-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
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
                  <div className="text-center px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{resumo.total}</p>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Seção: Gerar Obrigações com IA                                       */}
      {/* ------------------------------------------------------------------ */}
      {iaDisponivel !== false && (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-violet-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Calendário Fiscal com IA
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gere sugestões de obrigações fiscais para este cliente com base no regime tributário e CNAE.
            </p>
            {cliente && (!cliente.cnae || !cliente.regimeTributario) && (
              <div className="mt-2 flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                <Info size={13} className="shrink-0 mt-0.5" />
                <p className="text-xs">
                  Preencha o CNAE e Regime Tributário do cliente para gerar obrigações mais precisas.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleGerarObrigacoesIA}
            disabled={iaCarregando || iaCriando}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white
              bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed
              rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {iaCarregando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {iaCarregando ? 'Gerando…' : 'Gerar com IA'}
          </button>
        </div>

        {/* Erro da IA */}
        {iaErro && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{iaErro}</p>
          </div>
        )}

        {/* Resultados da IA */}
        {obrigacoesIa && obrigacoesIa.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                {obrigacoesIa.length} obrigação(ões) sugerida(s)
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => setObrigacoesSelecionadas(new Set(obrigacoesIa.map((_, i) => i)))}
                  className="hover:text-violet-600 transition-colors"
                >
                  Selecionar todas
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setObrigacoesSelecionadas(new Set())}
                  className="hover:text-red-500 transition-colors"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {obrigacoesIa.map((ob, idx) => (
                <label
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                    ${obrigacoesSelecionadas.has(idx)
                      ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-750'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={obrigacoesSelecionadas.has(idx)}
                    onChange={() => toggleObrigacao(idx)}
                    className="mt-0.5 accent-violet-600"
                  />
                  {/* Cor dot */}
                  <span
                    className="shrink-0 mt-1 w-3 h-3 rounded-full"
                    style={{ backgroundColor: ob.cor ?? '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {ob.nome}
                      </span>
                      {ob.recorrencia && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                          bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-gray-600">
                          {ob.recorrencia}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold
                        bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        Dia {ob.diaVencimento}
                      </span>
                    </div>
                    {ob.descricao && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ob.descricao}</p>
                    )}
                    {ob.fundamentoLegal && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 italic">
                        {ob.fundamentoLegal}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {/* Botão Adicionar ao Calendário */}
            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {obrigacoesSelecionadas.size} de {obrigacoesIa.length} selecionada(s)
              </p>
              <button
                type="button"
                onClick={handleAdicionarAoCalendario}
                disabled={obrigacoesSelecionadas.size === 0 || iaCriando}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white
                  bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed
                  rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {iaCriando && <Loader2 size={14} className="animate-spin" />}
                {iaCriando ? 'Adicionando…' : 'Adicionar ao Calendário'}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Seção: Chat por Cliente                                              */}
      {/* ------------------------------------------------------------------ */}
      {iaDisponivel !== false && (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={16} className="text-blue-500" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Chat por Cliente
          </h2>
          <Bot size={14} className="text-slate-400" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Converse com a IA sobre a situação fiscal deste cliente. O contexto do cliente é incluído automaticamente.
        </p>

        {chatBloqueado ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
            <Lock size={13} className="text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Chat temporariamente indisponível.</p>
          </div>
        ) : (
          /* Mini chat UI */
          <div className="flex flex-col gap-3">
            {/* Message list */}
            <div className="max-h-64 overflow-y-auto flex flex-col gap-2 px-1">
              {chatMessages.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                  Faça uma pergunta sobre este cliente para começar.
                </p>
              )}
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                      ${msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-slate-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100 rounded-bl-sm'
                      }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatCarregando && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-gray-700">
                    <Loader2 size={13} className="animate-spin text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Digitando…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {chatErro && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-400">{chatErro}</p>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">
              <textarea
                id="chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleChatEnviar();
                  }
                }}
                placeholder="Pergunte algo sobre este cliente… (Enter para enviar)"
                rows={2}
                aria-label="Mensagem"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-800
                  text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500
                  focus:outline-none focus:ring-2 focus:ring-primary resize-none transition-colors"
              />
              <button
                type="button"
                onClick={() => void handleChatEnviar()}
                disabled={!chatInput.trim() || chatCarregando}
                className="shrink-0 p-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Enviar mensagem"
                aria-label="Enviar mensagem"
              >
                {chatCarregando
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Send size={16} />
                }
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Seção: Sugestão de Regime Tributário                                 */}
      {/* ------------------------------------------------------------------ */}
      {iaDisponivel !== false && (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-5 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Sugestão de Regime Tributário
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A IA analisa o perfil do cliente e recomenda o regime tributário mais adequado com vantagens, desvantagens e alertas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleAnalisarRegime()}
            disabled={regimeCarregando}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white
              bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed
              rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {regimeCarregando ? <Loader2 size={15} className="animate-spin" /> : <TrendingUp size={15} />}
            {regimeCarregando ? 'Analisando…' : 'Analisar Regime com IA'}
          </button>
        </div>

        {/* Aviso quando bloqueado por outro motivo */}
        {regimeBloqueado && (
          <div className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
            <Lock size={13} className="text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Análise temporariamente indisponível.</p>
          </div>
        )}

        {/* Erro */}
        {regimeErro && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{regimeErro}</p>
          </div>
        )}

        {/* Resultado */}
        {regimeIa && (
          <div className="mt-5 space-y-4">
            {/* Regime recomendado */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Regime Recomendado
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                {regimeIa.regimeRecomendado}
              </span>
            </div>

            {/* Justificativa */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Justificativa
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {regimeIa.justificativa}
              </p>
            </div>

            {/* Vantagens */}
            {regimeIa.vantagens.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Vantagens
                </p>
                <ul className="space-y-1.5">
                  {regimeIa.vantagens.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Desvantagens */}
            {regimeIa.desvantagens.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Desvantagens
                </p>
                <ul className="space-y-1.5">
                  {regimeIa.desvantagens.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Alertas */}
            {regimeIa.alertas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Alertas
                </p>
                <ul className="space-y-1.5">
                  {regimeIa.alertas.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      )}

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
            aria-label="Buscar documento"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-800
              text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400" />

          {/* Filtro Setor */}
          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value as SetorTipo | '')}
            aria-label="Filtrar por setor"
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-800
              text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary dark:[color-scheme:dark]"
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
            aria-label="Filtrar por leitura"
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-800
              text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary dark:[color-scheme:dark]"
          >
            <option value="">Todos</option>
            <option value="nao_lido">Não lidos</option>
            <option value="lido">Lidos</option>
          </select>

          {/* Filtro Origem */}
          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem(e.target.value as Origem | '')}
            aria-label="Filtrar por origem"
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-800
              text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary dark:[color-scheme:dark]"
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando documentos…</p>
        </div>
      ) : docsFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
          <FileText size={28} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nenhum documento encontrado</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
            {busca.trim() || filtroSetor || filtroLeitura || filtroOrigem
              ? 'Tente ajustar os filtros.'
              : 'Este cliente ainda não possui documentos.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_100px_90px_100px_140px_150px_96px] gap-3 px-5 py-3
            border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <span>Documento</span>
            <span>Setor</span>
            <span>Tipo</span>
            <span>Tamanho</span>
            <span>Origem</span>
            <span>Leitura</span>
            <span className="text-center">Ações</span>
          </div>

          {/* Linhas */}
          <ul role="list" className="divide-y divide-slate-100 dark:divide-gray-700">
            {docsFiltrados.map((doc) => {
              const origemCfg = ORIGEM_CONFIG[doc.origem];
              const setorCfg  = getSetorConfig(doc.sector);
              const OrigemIcone = origemCfg.icone;

              return (
                <li key={doc.id} className="group">
                  <div className="lg:grid lg:grid-cols-[1fr_100px_90px_100px_140px_150px_96px] gap-3 items-center
                    px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">

                    {/* Documento: ícone de origem + nome + data */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${origemCfg.classes}`}>
                        <OrigemIcone size={16} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocumentoDetalheId(doc.id)}
                        className="min-w-0 text-left group/doc"
                        title="Abrir detalhes do documento"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover/doc:text-blue-700 dark:group-hover/doc:text-blue-300" title={doc.fileName}>
                          {doc.fileName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          <Clock size={10} />
                          <span>{formatarDataHora(doc.createdAt)}</span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span>por {doc.uploaderNome}</span>
                        </div>
                      </button>
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
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 lg:mt-0">
                      {formatarTamanho(doc.fileSizeBytes)}
                    </span>

                    {/* Origem */}
                    <div className="mt-1 lg:mt-0">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
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

                    {/* Ações: Download + Assinatura + Responsáveis */}
                    <div className="mt-2 lg:mt-0 flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={!!baixandoId || !!assinandoId}
                        title="Baixar arquivo"
                        aria-label={`Baixar ${doc.fileName}`}
                        className="p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {baixandoId === doc.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Download size={16} />
                        )}
                      </button>

                      {doc.fileType === 'PDF' && (
                        <button
                          onClick={() => handleSolicitarAssinatura(doc)}
                          disabled={!!baixandoId || !!assinandoId}
                          title="Solicitar assinatura"
                          aria-label={`Solicitar assinatura de ${doc.fileName}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {assinandoId === doc.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <PenLine size={16} />
                          )}
                        </button>
                      )}

                      {/* Botão de atribuir responsáveis */}
                      {funcionarios.length > 0 && (
                        <div className="relative" ref={responsaveisPopoverId === doc.id ? responsaveisPopoverRef : undefined}>
                          <button
                            onClick={() => responsaveisPopoverId === doc.id ? setResponsaveisPopoverId(null) : abrirResponsaveisPopover(doc.id)}
                            title="Atribuir responsáveis"
                            aria-label={`Atribuir responsáveis a ${doc.fileName}`}
                            className={[
                              'p-2 rounded-lg transition-colors',
                              responsaveisPopoverId === doc.id
                                ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20'
                                : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20',
                              (responsaveisPorDoc[doc.id] ?? []).length > 0
                                ? 'text-violet-500'
                                : '',
                            ].join(' ')}
                          >
                            <Users size={16} />
                          </button>

                          {responsaveisPopoverId === doc.id && (
                            <div className="absolute bottom-full right-0 mb-1.5 w-56 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 py-1 overflow-hidden">
                              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                                Responsáveis
                              </p>
                              <div className="max-h-44 overflow-y-auto">
                                {funcionarios.map((f) => {
                                  const selecionado = (responsaveisPorDoc[doc.id] ?? []).includes(f.id);
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => toggleResponsavel(doc.id, f.id)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                    >
                                      <div className={[
                                        'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 border',
                                        selecionado
                                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-700'
                                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-600',
                                      ].join(' ')}>
                                        {f.name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')}
                                      </div>
                                      <span className={`flex-1 text-left truncate ${selecionado ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {f.name}
                                      </span>
                                      {selecionado && <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2">
                                <button
                                  onClick={() => salvarResponsaveis(doc.id)}
                                  disabled={salvandoResponsaveis}
                                  className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                                >
                                  {salvandoResponsaveis ? 'Salvando…' : 'Salvar'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Rodapé */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {docsFiltrados.length} documento{docsFiltrados.length !== 1 ? 's' : ''}
              {busca.trim() || filtroSetor || filtroLeitura || filtroOrigem ? ' (filtrado)' : ''}
            </span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: detalhes e categorização do documento                        */}
      {/* ------------------------------------------------------------------ */}
      {documentoDetalhe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDocumentoDetalheId(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setDocumentoDetalheId(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-doc-titulo"
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
              <div>
                <h2 id="modal-doc-titulo" className="text-sm font-bold text-slate-900 dark:text-slate-100">Detalhes do Documento</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Clique em uma categoria para classificar o arquivo.</p>
              </div>
              <button
                onClick={() => setDocumentoDetalheId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Nome</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{documentoDetalhe.fileName}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo</p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{documentoDetalhe.fileType}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tamanho</p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{formatarTamanho(documentoDetalhe.fileSizeBytes)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Origem</p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{documentoDetalhe.origem === 'UPLOAD_CLIENTE' ? 'Cliente' : 'Escritório'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Enviado em</p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{formatarDataHora(documentoDetalhe.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Enviado por</p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{documentoDetalhe.uploaderNome}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Competência</p>
                  <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{documentoDetalhe.competencia ?? 'Não informada'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Status de leitura</p>
                {documentoDetalhe.readStatus ? (
                  <p className="text-sm text-emerald-700 font-medium">
                    Lido{documentoDetalhe.readAt ? ` em ${formatarDataHora(documentoDetalhe.readAt)}` : ''}
                  </p>
                ) : (
                  <p className="text-sm text-amber-700 font-medium">Não lido</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 p-4">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Categoria atual</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${getSetorConfig(documentoDetalhe.sector).classes}`}>
                  {getSetorConfig(documentoDetalhe.sector).label}
                </span>

                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-4 mb-2">Alterar categoria</p>
                <div className="flex flex-wrap gap-2">
                  {SETOR_OPCOES.map((opcao) => (
                    <button
                      key={opcao.value}
                      type="button"
                      onClick={() => handleAlterarSetor(documentoDetalhe, opcao.value)}
                      disabled={atualizandoSetorId === documentoDetalhe.id}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors
                        ${opcao.classes}
                        ${documentoDetalhe.sector === opcao.value ? 'ring-1 ring-offset-0 ring-slate-300' : ''}
                        disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {atualizandoSetorId === documentoDetalhe.id && documentoDetalhe.sector !== opcao.value ? 'Salvando...' : opcao.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setDocumentoDetalheId(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-gray-800
                  text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: link de assinatura gerado                                     */}
      {/* ------------------------------------------------------------------ */}
      {modalAssinatura && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setModalAssinatura(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setModalAssinatura(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-assinatura-titulo"
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <PenLine size={18} className="text-violet-600" />
                <h2 id="modal-assinatura-titulo" className="text-sm font-bold text-slate-900 dark:text-slate-100">Assinatura Solicitada</h2>
              </div>
              <button
                onClick={() => setModalAssinatura(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                O e-mail de assinatura foi enviado ao cliente. Você também pode copiar o link abaixo para compartilhar diretamente:
              </p>

              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Documento</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{modalAssinatura.nomeDoc}</p>
              </div>

              {modalAssinatura.expiresAt && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">Expira em</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {new Date(modalAssinatura.expiresAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Link de Assinatura</p>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate font-mono">
                    {modalAssinatura.link}
                  </p>
                  <button
                    onClick={() => copiarLink(modalAssinatura.link)}
                    className="shrink-0 p-1.5 rounded-md text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                    title="Copiar link"
                  >
                    {copiadoLink ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                  <a
                    href={modalAssinatura.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded-md text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Abrir link"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setModalAssinatura(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-gray-800
                  text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
