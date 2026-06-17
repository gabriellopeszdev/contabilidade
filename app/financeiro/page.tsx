'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  FileText,
  Loader2,
  Sparkles,
  ExternalLink,
  Copy,
  QrCode,
} from 'lucide-react';

import { useAuth } from '../../src/presentation/hooks/useAuth';
import { FiltroClienteCombobox } from '../../src/presentation/components/financeiro/FiltroClienteCombobox';

// =============================================================================
// Tipos
// =============================================================================

interface Boleto {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteCnpj: string;
  valor: number;
  vencimento: string;
  status: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
  mesReferencia: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  descricao: string | null;
  createdAt: string;
  // Asaas
  asaasId: string | null;
  asaasBoletoUrl: string | null;
  asaasBarcode: string | null;
  asaasPixCopiaECola: string | null;
}

interface ClienteOption {
  id:   string;
  nome: string;
  cnpj: string;
}

interface BoletoListResponse {
  boletos: Boleto[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_BADGE: Record<Boleto['status'], { label: string; classes: string }> = {
  PENDENTE:  { label: 'Pendente',  classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  PAGO:      { label: 'Pago',      classes: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  VENCIDO:   { label: 'Vencido',   classes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  CANCELADO: { label: 'Cancelado', classes: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
};

// =============================================================================
// Helpers
// =============================================================================

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function mesLabel(mes: string) {
  const [y, m] = mes.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(m, 10) - 1]}/${y}`;
}

function isVencido(iso: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const v = new Date(iso); v.setHours(0,0,0,0);
  return v < hoje;
}

function isVenceHoje(iso: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const v = new Date(iso); v.setHours(0,0,0,0);
  return v.getTime() === hoje.getTime();
}

function isVenceBreve(iso: string, dias = 3) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const v = new Date(iso); v.setHours(0,0,0,0);
  const diff = (v.getTime() - hoje.getTime()) / 86400000;
  return diff > 0 && diff <= dias;
}

// =============================================================================
// Página Financeiro (role-aware)
// =============================================================================

export default function FinanceiroPage() {
  const {
    token,
    getToken,
    isContador,
    isCliente,
    isFuncionarioEscritorio,
    isFuncionarioCliente,
    isDono,
    carregando: authCarregando,
  } = useAuth();

  const isVisaoContador = isContador || isFuncionarioEscritorio;
  const isVisaoCliente  = isCliente  || isFuncionarioCliente;

  // Estado compartilhado
  const [boletos, setBoletos]     = useState<Boleto[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]     = useState(true);

  // Filtros
  const [filtroStatus, setFiltroStatus]   = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');

  // Modal (contador only)
  const [modalAberto, setModalAberto]               = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteOption | null>(null);
  const [submitting, setSubmitting]                 = useState(false);

  // Form
  const [formCliente,    setFormCliente]    = useState('');
  const [formClienteObj, setFormClienteObj] = useState<ClienteOption | null>(null);
  const [formValor, setFormValor]           = useState('');
  const [formVencimento, setFormVencimento] = useState('');
  const [formMes, setFormMes]               = useState('');
  const [formDescricao, setFormDescricao]   = useState('');
  const [formErro, setFormErro]             = useState('');
  const [erros, setErros]                   = useState<Record<string, string>>({});

  // ===========================================================================
  // Fetch boletos
  // ===========================================================================
  const fetchBoletos = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const t = await getToken();
      const params = new URLSearchParams({ page: String(pg), limit: '15' });
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroCliente) params.set('clienteId', filtroCliente);

      const res = await fetch(`/api/v1/financeiro/boletos?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error();
      const data: BoletoListResponse = await res.json();
      setBoletos(data.boletos);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setBoletos([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, filtroStatus, filtroCliente]);

  useEffect(() => {
    if (!authCarregando && token) fetchBoletos(1);
  }, [authCarregando, token, fetchBoletos]);



  // ===========================================================================
  // Summary cards
  // ===========================================================================
  const resumo = useMemo(() => {
    const pendentes = boletos.filter((b) => b.status === 'PENDENTE');
    const pagos     = boletos.filter((b) => b.status === 'PAGO');
    const vencidos  = boletos.filter((b) => b.status === 'VENCIDO');
    return {
      aReceber:     pendentes.reduce((s, b) => s + b.valor, 0),
      recebido:     pagos.reduce((s, b) => s + b.valor, 0),
      qtdPendentes: pendentes.length,
      qtdVencidos:  vencidos.length,
      totalAberto:  pendentes.reduce((s, b) => s + b.valor, 0) + vencidos.reduce((s, b) => s + b.valor, 0),
    };
  }, [boletos]);

  // Alertas (visão cliente)
  const alertas = useMemo(() => {
    const vencidos  = boletos.filter((b) => b.status === 'PENDENTE' && isVencido(b.vencimento));
    const venceHoje = boletos.filter((b) => b.status === 'PENDENTE' && isVenceHoje(b.vencimento));
    return {
      vencidos,
      venceHoje,
      totalVencido: vencidos.reduce((s, b) => s + b.valor, 0),
    };
  }, [boletos]);

  const boletosFiltrados = boletos;

  // ===========================================================================
  // Exportar CSV
  // ===========================================================================
  const handleExportarCSV = async () => {
    try {
      const t = await getToken();
      const res = await fetch('/api/v1/financeiro/boletos/export', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'boletos.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao exportar CSV.');
    }
  };

  // ===========================================================================
  // Download / Ver Boleto
  // ===========================================================================
  const handleDownload = async (boleto: Boleto) => {
    // Asaas boleto — open external URL directly
    if (boleto.asaasBoletoUrl) {
      window.open(boleto.asaasBoletoUrl, '_blank');
      return;
    }
    try {
      const t = await getToken();
      const res = await fetch(`/api/v1/financeiro/boletos/${boleto.id}/download`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.open(data.url, '_blank');
    } catch {
      alert('Erro ao baixar o arquivo.');
    }
  };

  const copiarTexto = (texto: string) => {
    navigator.clipboard.writeText(texto).catch(() => {
      const el = document.createElement('textarea');
      el.value = texto;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  };

  // ===========================================================================
  // Update status (contador)
  // ===========================================================================
  const handleStatusUpdate = async (id: string, novoStatus: string) => {
    try {
      const t = await getToken();
      const res = await fetch(`/api/v1/financeiro/boletos/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.message ?? 'Erro ao atualizar status.');
        return;
      }
      fetchBoletos(page);
    } catch {
      alert('Erro ao atualizar status.');
    }
  };

  // ===========================================================================
  // Submit boleto (modal do contador)
  // ===========================================================================
  const fecharModal = () => {
    setModalAberto(false);
    setErros({});
    setFormErro('');
    setFormCliente('');
    setFormClienteObj(null);
  };

  const handleSubmit = async () => {
    setFormErro('');
    setErros({});

    setSubmitting(true);
    try {
      const t = await getToken();
      const res = await fetch('/api/v1/financeiro/boletos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteId:     formCliente,
          valor:         formValor,
          vencimento:    formVencimento,
          mesReferencia: formMes,
          descricao:     formDescricao,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 400 && data?.fields) {
          setErros(data.fields as Record<string, string>);
        } else {
          setFormErro(data?.message ?? data?.error ?? 'Erro ao gerar boleto.');
        }
        return;
      }

      setFormCliente('');
      setFormValor('');
      setFormVencimento('');
      setFormMes('');
      setFormDescricao('');
      setModalAberto(false);
      fetchBoletos(1);
    } catch {
      setFormErro('Erro de conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  // ===========================================================================
  // Render Loading
  // ===========================================================================
  if (authCarregando) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // ===========================================================================
  // Render — Visão CLIENTE
  // ===========================================================================
  if (isVisaoCliente) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Alertas */}
        {alertas.vencidos.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                Você tem {alertas.vencidos.length} boleto{alertas.vencidos.length > 1 ? 's' : ''} vencido{alertas.vencidos.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                Total em atraso: {formatMoney(alertas.totalVencido)}
              </p>
            </div>
          </div>
        )}

        {alertas.venceHoje.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Clock size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                {alertas.venceHoje.length} boleto{alertas.venceHoje.length > 1 ? 's' : ''} vence{alertas.venceHoje.length > 1 ? 'm' : ''} hoje!
              </p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Em Aberto</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatMoney(resumo.totalAberto)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Pago</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatMoney(resumo.recebido)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Título */}
        <div className="flex items-center gap-2">
          <DollarSign size={20} className="text-primary" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Meus Boletos</h2>
        </div>

        {/* Tabela */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : boletosFiltrados.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum boleto encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Mês Ref.</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Descrição</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Valor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Vencimento</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {boletosFiltrados.map((b) => {
                    const badge = STATUS_BADGE[b.status];
                    const urgente = b.status === 'PENDENTE' && (isVencido(b.vencimento) || isVenceHoje(b.vencimento));
                    const breve   = b.status === 'PENDENTE' && isVenceBreve(b.vencimento);
                    return (
                      <tr
                        key={b.id}
                        className={`
                          hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors
                          ${urgente ? 'bg-red-50/40 dark:bg-red-900/10' : breve ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}
                        `}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{mesLabel(b.mesReferencia)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{b.descricao || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatMoney(b.valor)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(b.vencimento)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleDownload(b)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-dark dark:text-primary bg-primary-50 dark:bg-primary/10 hover:bg-primary-50 dark:hover:bg-primary/20 transition-colors"
                              title={b.asaasBoletoUrl ? 'Ver boleto no Asaas' : 'Baixar PDF'}
                            >
                              {b.asaasBoletoUrl ? <ExternalLink size={14} /> : <Download size={14} />}
                              {b.asaasBoletoUrl ? 'Ver Boleto' : 'Baixar'}
                            </button>
                            {b.asaasBarcode && (
                              <button
                                onClick={() => copiarTexto(b.asaasBarcode!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                title="Copiar linha digitável"
                              >
                                <Copy size={14} />
                                Cód. Barras
                              </button>
                            )}
                            {b.asaasPixCopiaECola && (
                              <button
                                onClick={() => copiarTexto(b.asaasPixCopiaECola!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                                title="Copiar PIX copia e cola"
                              >
                                <QrCode size={14} />
                                PIX
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {total} boleto{total !== 1 ? 's' : ''} • Página {page} de {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => fetchBoletos(page - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchBoletos(page + 1)}
                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // Render — Visão CONTADOR
  // ===========================================================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<DollarSign size={18} />} label="A Receber" value={formatMoney(resumo.aReceber)} cor="blue" />
        <SummaryCard icon={<CheckCircle2 size={18} />} label="Recebido" value={formatMoney(resumo.recebido)} cor="emerald" />
        <SummaryCard icon={<Clock size={18} />} label="Pendentes" value={String(resumo.qtdPendentes)} cor="amber" />
        <SummaryCard icon={<AlertTriangle size={18} />} label="Vencidos" value={String(resumo.qtdVencidos)} cor="red" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DollarSign size={20} className="text-primary" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Honorários</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Filtro status */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <select
              value={filtroStatus}
              onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }}
              className="pl-9 pr-8 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent appearance-none dark:[color-scheme:dark]"
            >
              <option value="">Todos os status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PAGO">Pago</option>
              <option value="VENCIDO">Vencido</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {/* Filtro cliente — combobox com busca server-side */}
          {isVisaoContador && (
            <FiltroClienteCombobox
              getToken={getToken}
              value={clienteSelecionado}
              onChange={(c) => {
                setClienteSelecionado(c);
                setFiltroCliente(c?.id ?? '');
                setPage(1);
              }}
            />
          )}

          {/* Botão Exportar CSV */}
          <button
            onClick={handleExportarCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Download size={14} />
            Exportar CSV
          </button>

          {/* Botão novo boleto */}
          {isDono && isVisaoContador && (
            <button
              onClick={() => { setErros({}); setFormErro(''); setModalAberto(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-colors"
            >
              <Plus size={14} />
              Novo Honorário
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : boletosFiltrados.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum boleto encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Mês Ref.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Vencimento</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {boletosFiltrados.map((b) => {
                  const badge = STATUS_BADGE[b.status];
                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[180px]">{b.clienteNome}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{b.clienteCnpj}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{mesLabel(b.mesReferencia)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatMoney(b.valor)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(b.vencimento)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {/* Ver/baixar boleto */}
                          <button
                            onClick={() => handleDownload(b)}
                            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-primary-50 dark:hover:bg-primary/10 transition-colors"
                            title={b.asaasBoletoUrl ? 'Ver boleto no Asaas' : 'Baixar PDF'}
                          >
                            {b.asaasBoletoUrl ? <ExternalLink size={15} /> : <Download size={15} />}
                          </button>

                          {/* Copiar linha digitável */}
                          {b.asaasBarcode && (
                            <button
                              onClick={() => copiarTexto(b.asaasBarcode!)}
                              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="Copiar linha digitável"
                            >
                              <Copy size={15} />
                            </button>
                          )}

                          {/* PIX copia e cola */}
                          {b.asaasPixCopiaECola && (
                            <button
                              onClick={() => copiarTexto(b.asaasPixCopiaECola!)}
                              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                              title="Copiar PIX copia e cola"
                            >
                              <QrCode size={15} />
                            </button>
                          )}

                          {isDono && b.status === 'PENDENTE' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(b.id, 'PAGO')}
                                className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                title="Marcar como Pago"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(b.id, 'CANCELADO')}
                                className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Cancelar"
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                          {isDono && b.status === 'VENCIDO' && (
                            <button
                              onClick={() => handleStatusUpdate(b.id, 'PAGO')}
                              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                              title="Marcar como Pago"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {total} registro{total !== 1 ? 's' : ''} • Página {page} de {totalPages}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => fetchBoletos(page - 1)}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchBoletos(page + 1)}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================== Modal: Novo Honorário ====================== */}
      {modalAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={fecharModal}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Gerar Novo Honorário</h3>
              <button onClick={fecharModal} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={18} className="text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Erro genérico (ex: erro de conexão, 500) */}
              {formErro && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
                  {formErro}
                </div>
              )}

              {/* Cliente */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
                <FiltroClienteCombobox
                  getToken={getToken}
                  value={formClienteObj}
                  onChange={(c) => {
                    setFormClienteObj(c);
                    setFormCliente(c?.id ?? '');
                    setErros((p) => ({ ...p, clienteId: '' }));
                  }}
                  placeholder="Buscar cliente…"
                />
                {erros.clienteId && <p className="mt-1 text-xs text-red-600">{erros.clienteId}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Valor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formValor}
                    onChange={(e) => { setFormValor(e.target.value); setErros((p) => ({ ...p, valor: '' })); }}
                    placeholder="1500.00"
                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 ${erros.valor ? 'border-red-500 bg-red-50/30' : 'border-gray-200 dark:border-gray-600'}`}
                  />
                  {erros.valor && <p className="mt-1 text-xs text-red-600">{erros.valor}</p>}
                </div>

                {/* Vencimento */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Vencimento *</label>
                  <input
                    type="date"
                    value={formVencimento}
                    onChange={(e) => { setFormVencimento(e.target.value); setErros((p) => ({ ...p, vencimento: '' })); }}
                    className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-gray-100 ${erros.vencimento ? 'border-red-500 bg-red-50/30' : 'border-gray-200 dark:border-gray-600'}`}
                  />
                  {erros.vencimento && <p className="mt-1 text-xs text-red-600">{erros.vencimento}</p>}
                </div>
              </div>

              {/* Mês referência */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Mês de Referência *</label>
                <input
                  type="month"
                  value={formMes}
                  onChange={(e) => { setFormMes(e.target.value); setErros((p) => ({ ...p, mesReferencia: '' })); }}
                  className={`w-full px-3 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:text-gray-100 ${erros.mesReferencia ? 'border-red-500 bg-red-50/30' : 'border-gray-200 dark:border-gray-600'}`}
                />
                {erros.mesReferencia && <p className="mt-1 text-xs text-red-600">{erros.mesReferencia}</p>}
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <input
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder="Honorários contábeis, folha de pagamento, etc."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Aviso geração automática */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary-50 dark:bg-primary/10 border border-primary/20 dark:border-primary/20">
                <Sparkles size={15} className="text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary-dark dark:text-primary">
                  Se a integração Asaas estiver configurada, um boleto bancário real será emitido. Caso contrário, um PDF será gerado automaticamente.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <button
                onClick={fecharModal}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {submitting ? 'Gerando…' : 'Gerar Boleto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Summary Card — Componente auxiliar do Contador
// =============================================================================

function SummaryCard({
  icon,
  label,
  value,
  cor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  cor: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-${cor}-100 dark:bg-${cor}-900/30 flex items-center justify-center text-${cor}-600 dark:text-${cor}-400`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
    </div>
  );
}
