'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Loader2,
  AlertCircle,
  Search,
  Pencil,
  Plus,
  X,
  ChevronDown,
  FileText,
  CreditCard,
  History,
  Trash2,
  ExternalLink,
  DollarSign,
  QrCode,
  RefreshCw,
  Info,
} from 'lucide-react';

import { toast } from 'sonner';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================
type StatusSaaS = 'TRIAL' | 'ATIVO' | 'INADIMPLENTE' | 'CANCELADO' | 'SUSPENSO';

interface SubscricaoDTO {
  id:               string;
  status:           StatusSaaS;
  escritorioId:     string;
  escritorioNome:   string;
  escritorioEmail:  string;
  escritorioAtivo:  boolean;
  planoId:          string;
  planoNome:        string;
  precoPlano:       number;
  valorMensal:      number;
  diaVencimento:    number;
  dataInicio:       string;
  dataRenovacao:    string;
  observacoes:      string | null;
}

interface SemSubscricaoDTO {
  id:       string;
  nome:     string;
  email:    string;
  isActive: boolean;
}

interface PlanoDTO {
  id:               string;
  nome:             string;
  preco:            number;
  limiteClientes:   number;
  limiteDocumentos: number;
  isActive:         boolean;
}

interface DadosFaturamento {
  subscricoes:       SubscricaoDTO[];
  semSubscricao:     SemSubscricaoDTO[];
  mrr:               number;
  totalAtivo:        number;
  totalTrial:        number;
  totalInadimplente: number;
}

interface FormSubscricao {
  escritorioId:  string;
  planoId:       string;
  status:        StatusSaaS;
  valorMensal:   string;
  diaVencimento: string;
  dataRenovacao: string;
  observacoes:   string;
}

interface CobrancaSaaS {
  id: string;
  escritorioId: string;
  escritorioNome: string;
  escritorioEmail: string;
  planoNome: string;
  valor: number;
  vencimento: string;
  mesReferencia: string;
  status: string;
  asaasPaymentId: string | null;
  asaasBoletoUrl: string | null;
  asaasInvoiceUrl: string | null;
}

interface DadosCobrancas {
  cobrancas: CobrancaSaaS[];
  stats: {
    totalPagas: number;
    totalPendentes: number;
    totalVencidas: number;
    totalGeral: number;
  };
}

const FORM_VAZIO: FormSubscricao = {
  escritorioId:  '',
  planoId:       '',
  status:        'TRIAL',
  valorMensal:   '',
  diaVencimento: '10',
  dataRenovacao: '',
  observacoes:   '',
};

// =============================================================================
// Helpers
// =============================================================================
const STATUS_CONFIG: Record<StatusSaaS, { label: string; classes: string }> = {
  TRIAL:        { label: 'Trial (7 dias)', classes: 'text-amber-400 bg-amber-900/30 border-amber-700/40' },
  ATIVO:        { label: 'Ativo',        classes: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40' },
  INADIMPLENTE: { label: 'Inadimplente', classes: 'text-red-400 bg-red-900/30 border-red-700/40' },
  CANCELADO:    { label: 'Cancelado',    classes: 'text-slate-400 bg-slate-800 border-slate-700' },
  SUSPENSO:     { label: 'Suspenso',     classes: 'text-orange-400 bg-orange-900/30 border-orange-700/40' },
};

function StatusBadge({ status }: { status: StatusSaaS }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.CANCELADO;
  return (
    <span className={`inline-flex items-center text-[11px] font-medium border px-2 py-0.5 rounded-full ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function CobrancaStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    PAGO: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
    PENDENTE: 'text-amber-400 bg-amber-900/30 border-amber-700/40',
    VENCIDO: 'text-red-400 bg-red-900/30 border-red-700/40',
    CANCELADO: 'text-slate-400 bg-slate-800 border-slate-700',
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-medium border px-2.5 py-0.5 rounded-full ${classes[status] ?? classes.PENDENTE}`}>
      {status}
    </span>
  );
}

function formatBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// =============================================================================
// KPI Card
// =============================================================================
function KpiCard({
  label,
  valor,
  sub,
  cor,
}: {
  label: string;
  valor: string | number;
  sub?:  string;
  cor:   string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function FaturamentoPage() {
  const { token } = useAuth();
  const [tabAtiva, setTabAtiva] = useState<'assinaturas' | 'cobrancas'>('assinaturas');

  const [dados,     setDados]     = useState<DadosFaturamento | null>(null);
  const [planos,    setPlanos]    = useState<PlanoDTO[]>([]);
  const [cobrancasData, setCobrancasData] = useState<DadosCobrancas | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);

  const [busca,       setBusca]       = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Modal de assinatura (criar / editar)
  const [modalForm,    setModalForm]    = useState<FormSubscricao | null>(null);
  const [modalNome,    setModalNome]    = useState<string>('');
  const [modalSubId,   setModalSubId]   = useState<string | null>(null); // null = criar, id = editar
  const [salvando,     setSalvando]     = useState(false);
  const [erroModal,    setErroModal]    = useState<string | null>(null);

  // Modal de confirmação de cancelamento de cobrança
  const [cancelTarget, setCancelTarget] = useState<{ id: string } | null>(null);
  const [cancelando,   setCancelando]   = useState(false);

  // Modal de cobrança manual
  const [showManualBillingModal, setShowManualBillingModal] = useState(false);
  const [manualBillingForm, setManualBillingForm] = useState({
    action: 'criar_cobranca_avulsa' as 'criar_cobranca_avulsa' | 'criar_assinatura',
    escritorioId: '',
    valor: '',
    vencimento: '',
    descricao: '',
    billingType: 'BOLETO' as 'BOLETO' | 'PIX' | 'CREDIT_CARD',
  });
  const [gerandoCobranca, setGerandoCobranca] = useState(false);
  const [erroCobranca, setErroCobranca] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      if (busca.trim()) params.set('search', busca.trim());

      const [resSub, resPlanos] = await Promise.all([
        fetch(`/api/v1/admin/subscricoes?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/admin/planos', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!resSub.ok)    throw new Error(`Subscricoes HTTP ${resSub.status}`);
      if (!resPlanos.ok) throw new Error(`Planos HTTP ${resPlanos.status}`);

      const [dataSub, dataPlanos] = await Promise.all([
        resSub.json()    as Promise<DadosFaturamento>,
        resPlanos.json() as Promise<PlanoDTO[]>,
      ]);

      setDados(dataSub);
      setPlanos(dataPlanos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setCarregando(false);
    }
  }, [token, filtroStatus, busca]);

  const carregarCobrancas = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/admin/faturamento', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Faturamento HTTP ${res.status}`);
      const data = await res.json() as DadosCobrancas;
      setCobrancasData(data);
    } catch (e) {
      console.error('Erro ao carregar faturas emitidas', e instanceof Error ? e : undefined);
    }
  }, [token]);

  useEffect(() => {
    carregarDados();
    if (tabAtiva === 'cobrancas') {
      carregarCobrancas();
    }
  }, [tabAtiva, carregarDados, carregarCobrancas]);

  // Abre modal para editar assinatura existente
  function abrirEditar(sub: SubscricaoDTO) {
    setModalSubId(sub.id);
    setModalNome(sub.escritorioNome);
    setErroModal(null);
    setModalForm({
      escritorioId:  sub.escritorioId,
      planoId:       sub.planoId,
      status:        sub.status,
      valorMensal:   String(sub.valorMensal),
      diaVencimento: String(sub.diaVencimento),
      dataRenovacao: sub.dataRenovacao ? sub.dataRenovacao.slice(0, 10) : '',
      observacoes:   sub.observacoes ?? '',
    });
  }

  // Abre modal para atribuir plano a escritório sem assinatura
  function abrirAtribuir(esc: SemSubscricaoDTO) {
    setModalSubId(null);
    setModalNome(esc.nome);
    setErroModal(null);
    setModalForm({ ...FORM_VAZIO, escritorioId: esc.id });
  }

  // Salva (criar ou editar)
  async function salvarSubscricao(form: FormSubscricao) {
    if (!token) return;
    setSalvando(true);
    setErroModal(null);
    try {
      const isEditar = !!modalSubId;
      const url  = isEditar ? `/api/v1/admin/subscricoes/${modalSubId}` : '/api/v1/admin/subscricoes';
      const method = isEditar ? 'PATCH' : 'POST';

      const payload = {
        escritorioId:  form.escritorioId,
        planoId:       form.planoId,
        status:        form.status,
        valorMensal:   form.valorMensal   ? parseFloat(form.valorMensal)       : undefined,
        diaVencimento: form.diaVencimento ? parseInt(form.diaVencimento, 10)   : undefined,
        dataRenovacao: form.dataRenovacao || undefined,
        observacoes:   form.observacoes   || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }

      setModalForm(null);
      await carregarDados();
    } catch (e) {
      setErroModal(e instanceof Error ? e.message : 'Erro ao salvar assinatura.');
    } finally {
      setSalvando(false);
    }
  }

  const handleEmitirCobranca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setGerandoCobranca(true);
    setErroCobranca(null);
    try {
      const res = await fetch('/api/v1/admin/faturamento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: manualBillingForm.action,
          escritorioId: manualBillingForm.escritorioId,
          valor: manualBillingForm.valor ? parseFloat(manualBillingForm.valor) : undefined,
          vencimento: manualBillingForm.vencimento || undefined,
          descricao: manualBillingForm.descricao || undefined,
          billingType: manualBillingForm.billingType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? 'Erro ao gerar cobrança no Asaas.');
      }

      setShowManualBillingModal(false);
      setManualBillingForm({
        action: 'criar_cobranca_avulsa',
        escritorioId: '',
        valor: '',
        vencimento: '',
        descricao: '',
        billingType: 'BOLETO',
      });
      await carregarCobrancas();
    } catch (err) {
      setErroCobranca(err instanceof Error ? err.message : 'Falha na conexão.');
    } finally {
      setGerandoCobranca(false);
    }
  };

  const handleCancelarCobranca = (id: string) => {
    setCancelTarget({ id });
  };

  const executarCancelamento = async () => {
    if (!cancelTarget || !token) return;
    setCancelando(true);
    try {
      const res = await fetch(`/api/v1/admin/faturamento/${cancelTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Erro ao cancelar fatura.');
      }
      toast.success('Cobrança cancelada com sucesso.');
      setCancelTarget(null);
      await carregarCobrancas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na requisição.');
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-violet-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Faturamento SaaS</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              MRR, faturas emitidas e controle de mensalidades por escritório.
            </p>
          </div>
        </div>
        
        {/* Ações Rápidas */}
        {tabAtiva === 'cobrancas' && (
          <button
            onClick={() => setShowManualBillingModal(true)}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all"
          >
            <Plus size={14} />
            Gerar Fatura / Assinatura
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setTabAtiva('assinaturas')}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            tabAtiva === 'assinaturas'
              ? 'border-violet-500 text-violet-400 bg-violet-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard size={15} />
          Assinaturas dos Escritórios
        </button>
        <button
          onClick={() => setTabAtiva('cobrancas')}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
            tabAtiva === 'cobrancas'
              ? 'border-violet-500 text-violet-400 bg-violet-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History size={15} />
          Faturas Emitidas (SaaS)
        </button>
      </div>

      {/* Carregando / Erro */}
      {carregando && tabAtiva === 'assinaturas' && (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-violet-400" />
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 text-red-400 rounded-xl px-5 py-4">
          <AlertCircle size={18} />
          <span className="text-sm">{erro}</span>
        </div>
      )}

      {/* Conteúdo Aba Assinaturas */}
      {tabAtiva === 'assinaturas' && !carregando && !erro && dados && (
        <>
          {/* KPIs Assinaturas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="MRR"
              valor={formatBRL(dados.mrr)}
              sub="Receita mensal recorrente"
              cor="text-violet-400"
            />
            <KpiCard
              label="Assinaturas Ativas"
              valor={dados.totalAtivo}
              cor="text-emerald-400"
            />
            <KpiCard
              label="Em Trial (7 dias)"
              valor={dados.totalTrial}
              cor="text-amber-400"
            />
            <KpiCard
              label="Inadimplentes"
              valor={dados.totalInadimplente}
              cor="text-red-400"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por escritório ou e-mail..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
            <div className="relative">
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="appearance-none bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 pr-8 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 animate-none"
              >
                <option value="">Todos os status</option>
                <option value="TRIAL">Trial</option>
                <option value="ATIVO">Ativo</option>
                <option value="INADIMPLENTE">Inadimplente</option>
                <option value="SUSPENSO">Suspenso</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Tabela de Assinaturas */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Assinaturas Ativas no Sistema</h2>
              <span className="text-xs text-slate-500">{dados.subscricoes.length} registro(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="px-5 py-3 text-xs font-medium text-slate-400">Escritório</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400">Plano</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400 text-center">Status</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400 text-right">Valor/mês</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400">Próx. Renovação</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {dados.subscricoes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                        Nenhuma assinatura encontrada.
                      </td>
                    </tr>
                  ) : (
                    dados.subscricoes.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-slate-100 font-medium truncate max-w-[200px]">
                            {sub.escritorioNome}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{sub.escritorioEmail}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-300">{sub.planoNome}</td>
                        <td className="px-5 py-3.5 text-center">
                          <StatusBadge status={sub.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-200 font-medium">
                          {formatBRL(sub.valorMensal)}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">
                          {formatDate(sub.dataRenovacao)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => abrirEditar(sub)}
                            className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Pencil size={12} />
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sem Plano */}
          {dados.semSubscricao.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h2 className="text-sm font-semibold text-slate-100">Escritórios Sem Plano Cadastrado</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {dados.semSubscricao.length} escritório(s) ativos no sistema sem parametrização de assinatura.
                </p>
              </div>
              <div className="divide-y divide-slate-800/60">
                {dados.semSubscricao.map((esc) => (
                  <div key={esc.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
                    <div>
                      <p className="text-slate-200 text-sm font-medium">{esc.nome}</p>
                      <p className="text-xs text-slate-500">{esc.email}</p>
                    </div>
                    <button
                      onClick={() => abrirAtribuir(esc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-400 hover:text-white bg-violet-600/10 hover:bg-violet-600 border border-violet-600/30 hover:border-violet-600 rounded-lg transition-colors"
                    >
                      <Plus size={12} />
                      Atribuir Plano
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Conteúdo Aba Cobranças */}
      {tabAtiva === 'cobrancas' && cobrancasData && (
        <>
          {/* KPIs Faturamento */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Recebido (PAGO)"
              valor={formatBRL(cobrancasData.stats.totalPagas)}
              cor="text-emerald-400"
            />
            <KpiCard
              label="A Receber (PENDENTE)"
              valor={formatBRL(cobrancasData.stats.totalPendentes)}
              cor="text-amber-400"
            />
            <KpiCard
              label="Total Atrasado (VENCIDO)"
              valor={formatBRL(cobrancasData.stats.totalVencidas)}
              cor="text-red-400"
            />
            <KpiCard
              label="Volume Total Emitido"
              valor={formatBRL(cobrancasData.stats.totalGeral)}
              cor="text-slate-200"
            />
          </div>

          {/* Tabela de Invoices */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Faturas SaaS Emitidas no Asaas</h2>
              <span className="text-xs text-slate-500">{cobrancasData.cobrancas.length} cobrança(s) encontrada(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="px-5 py-3 text-xs font-medium text-slate-400">Escritório</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400">Mês Ref.</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400">Vencimento</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400 text-right">Valor</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400 text-center">Status</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400 text-center">Asaas ID</th>
                    <th className="px-5 py-3 text-xs font-medium text-slate-400 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cobrancasData.cobrancas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                        Nenhuma cobrança registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    cobrancasData.cobrancas.map((cob) => (
                      <tr key={cob.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-slate-100 font-medium truncate max-w-[180px]">{cob.escritorioNome}</p>
                          <p className="text-xs text-slate-500 truncate">{cob.escritorioEmail}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-300 font-semibold">{cob.mesReferencia}</td>
                        <td className="px-5 py-3.5 text-slate-400">{cob.vencimento.split('-').reverse().join('/')}</td>
                        <td className="px-5 py-3.5 text-right text-slate-200 font-bold">{formatBRL(cob.valor)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <CobrancaStatusBadge status={cob.status} />
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono text-xs text-slate-500">{cob.asaasPaymentId ?? '-'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex gap-2 justify-end">
                            {cob.asaasBoletoUrl && (
                              <a
                                href={cob.asaasBoletoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                                title="Ver Fatura Asaas"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                            {(cob.status === 'PENDENTE' || cob.status === 'VENCIDO') && (
                              <button
                                onClick={() => handleCancelarCobranca(cob.id)}
                                className="p-1 text-red-500 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                                title="Cancelar Cobrança"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Editar Assinatura */}
      {modalForm && (
        <ModalAssinatura
          planos={planos}
          form={modalForm}
          escritorioNome={modalNome || undefined}
          onFechar={() => setModalForm(null)}
          onSalvar={salvarSubscricao}
          salvando={salvando}
          erro={erroModal}
        />
      )}

      {/* Modal Confirmar Cancelamento de Cobrança */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => !cancelando && setCancelTarget(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Cancelar Cobrança</h3>
                <p className="text-xs text-slate-400 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Deseja realmente cancelar esta cobrança no Asaas?
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                disabled={cancelando}
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={cancelando}
                onClick={executarCancelamento}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all"
              >
                {cancelando && <Loader2 size={12} className="animate-spin" />}
                Cancelar Cobrança
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Emitir Cobrança Manual */}
      {showManualBillingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowManualBillingModal(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Gerar Cobrança SaaS (Asaas)</h3>
              <button onClick={() => setShowManualBillingModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {erroCobranca && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 p-2.5 rounded-lg">
                {erroCobranca}
              </p>
            )}

            <form onSubmit={handleEmitirCobranca} className="space-y-4">
              {/* Escritório */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Escritório Contábil *</label>
                <div className="relative">
                  <select
                    required
                    value={manualBillingForm.escritorioId}
                    onChange={(e) => setManualBillingForm(f => ({ ...f, escritorioId: e.target.value }))}
                    className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Selecione...</option>
                    {dados?.subscricoes.map(s => (
                      <option key={s.escritorioId} value={s.escritorioId}>{s.escritorioNome}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Ação */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Ação de Faturamento *</label>
                <div className="relative">
                  <select
                    required
                    value={manualBillingForm.action}
                    onChange={(e) => setManualBillingForm(f => ({ ...f, action: e.target.value as any }))}
                    className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="criar_cobranca_avulsa">Emitir Fatura Avulsa (Boleto/Pix Único)</option>
                    <option value="criar_assinatura">Ativar/Sincronizar Assinatura Recorrente no Asaas</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Meio de Pagamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Meio de Pagamento Padrão *</label>
                <div className="relative">
                  <select
                    required
                    value={manualBillingForm.billingType}
                    onChange={(e) => setManualBillingForm(f => ({ ...f, billingType: e.target.value as any }))}
                    className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="BOLETO">Boleto ou Pix</option>
                    <option value="PIX">Somente Pix</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {manualBillingForm.action === 'criar_cobranca_avulsa' && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Valor (R$) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      placeholder="129.90"
                      value={manualBillingForm.valor}
                      onChange={(e) => setManualBillingForm(f => ({ ...f, valor: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Vencimento *</label>
                    <input
                      type="date"
                      required
                      value={manualBillingForm.vencimento}
                      onChange={(e) => setManualBillingForm(f => ({ ...f, vencimento: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Descrição / Notas Internas *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mensalidade junho/2026"
                  value={manualBillingForm.descricao}
                  onChange={(e) => setManualBillingForm(f => ({ ...f, descricao: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800 justify-end">
                <button
                  type="button"
                  onClick={() => setShowManualBillingModal(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={gerandoCobranca}
                  className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all"
                >
                  {gerandoCobranca && <Loader2 size={12} className="animate-spin" />}
                  Gerar no Asaas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Componente: ModalAssinatura
// =============================================================================
function ModalAssinatura({
  planos,
  form: formInicial,
  escritorioNome,
  onFechar,
  onSalvar,
  salvando,
  erro,
}: {
  planos:        PlanoDTO[];
  form:          FormSubscricao;
  escritorioNome?: string;
  onFechar:      () => void;
  onSalvar:      (f: FormSubscricao) => void;
  salvando:      boolean;
  erro:          string | null;
}) {
  const [form, setForm] = useState<FormSubscricao>(formInicial);

  function setField<K extends keyof FormSubscricao>(k: K, v: FormSubscricao[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Preenche valorMensal quando plano muda
  function handlePlanoChange(planoId: string) {
    const plano = planos.find((p) => p.id === planoId);
    setForm((f) => ({
      ...f,
      planoId,
      valorMensal: plano ? String(plano.preco) : f.valorMensal,
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onFechar} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Assinatura SaaS</h2>
            {escritorioNome && (
              <p className="text-xs text-slate-400 mt-0.5">{escritorioNome}</p>
            )}
          </div>
          <button onClick={onFechar} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 space-y-4">
          {erro && (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/40 text-red-400 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={15} />
              {erro}
            </div>
          )}

          {/* Plano */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Plano *</label>
            <div className="relative">
              <select
                value={form.planoId}
                onChange={(e) => handlePlanoChange(e.target.value)}
                className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              >
                <option value="">Selecione um plano...</option>
                {planos.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {formatBRL(p.preco)}/mês
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as StatusSaaS)}
                className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              >
                <option value="TRIAL">Trial</option>
                <option value="ATIVO">Ativo</option>
                <option value="INADIMPLENTE">Inadimplente</option>
                <option value="SUSPENSO">Suspenso</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Valor mensal + Dia vencimento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Valor Mensal (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.valorMensal}
                onChange={(e) => setField('valorMensal', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Dia de Vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                value={form.diaVencimento}
                onChange={(e) => setField('diaVencimento', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
          </div>

          {/* Data renovação */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Próxima Renovação</label>
            <input
              type="date"
              value={form.dataRenovacao}
              onChange={(e) => setField('dataRenovacao', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Observações</label>
            <input
              type="text"
              value={form.observacoes}
              onChange={(e) => setField('observacoes', e.target.value)}
              placeholder="Notas internas..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-800 flex gap-3 justify-end">
          <button
            onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSalvar(form)}
            disabled={salvando || !form.planoId}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
