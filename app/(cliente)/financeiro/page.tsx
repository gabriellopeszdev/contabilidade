'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DollarSign,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Copy,
  QrCode,
  Filter,
} from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

type StatusBoleto = 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO';
type Provider = 'asaas' | 'cora' | 'local';

interface Boleto {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteCnpj: string;
  valor: number;
  vencimento: string;
  status: StatusBoleto;
  mesReferencia: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  descricao: string | null;
  asaasId: string | null;
  asaasBoletoUrl: string | null;
  asaasBarcode: string | null;
  asaasPixCopiaECola: string | null;
  coraId: string | null;
  coraBoletoUrl: string | null;
  coraBarcode: string | null;
  coraPixPayload: string | null;
  provider: Provider;
  createdAt: string;
}

interface ApiResponse {
  boletos: Boleto[];
  total: number;
  page: number;
  totalPages: number;
}

// =============================================================================
// Helpers
// =============================================================================

const STATUS_CONFIG: Record<StatusBoleto, { label: string; badge: string }> = {
  PENDENTE: {
    label: 'Pendente',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  },
  PAGO: {
    label: 'Pago',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  },
  VENCIDO: {
    label: 'Vencido',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
  },
  CANCELADO: {
    label: 'Cancelado',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  },
};

const FILTROS: { label: string; valor: '' | StatusBoleto }[] = [
  { label: 'Todos', valor: '' },
  { label: 'Pendente', valor: 'PENDENTE' },
  { label: 'Pago', valor: 'PAGO' },
  { label: 'Vencido', valor: 'VENCIDO' },
  { label: 'Cancelado', valor: 'CANCELADO' },
];

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatarMesReferencia(mes: string) {
  // "2026-06" → "jun/2026"
  const [ano, m] = mes.split('-');
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const idx = parseInt(m, 10) - 1;
  return `${meses[idx] ?? m}/${ano}`;
}

// =============================================================================
// Página /financeiro — Boletos do Cliente
// =============================================================================

export default function FinanceiroPage() {
  const { getToken } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [boletos, setBoletos]           = useState<Boleto[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusBoleto>('');
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [baixandoId, setBaixandoId]     = useState<string | null>(null);
  const [toast, setToast]               = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const mostrarToast = (tipo: 'sucesso' | 'erro', msg: string) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const carregarBoletos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filtroStatus) params.set('status', filtroStatus);

      const res = await fetch(`/api/v1/financeiro/boletos?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Erro ao carregar cobranças.');
      }

      const data: ApiResponse = await res.json();
      setBoletos(data.boletos ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cobranças.');
    } finally {
      setLoading(false);
    }
  }, [getToken, filtroStatus, page]);

  useEffect(() => {
    carregarBoletos();
  }, [carregarBoletos]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFiltro = (valor: '' | StatusBoleto) => {
    setFiltroStatus(valor);
    setPage(1);
  };

  const handleDownloadLocal = async (boleto: Boleto) => {
    setBaixandoId(boleto.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/v1/financeiro/boletos/${boleto.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Não foi possível obter o link de download.');
      const { url } = await res.json();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      mostrarToast('erro', err instanceof Error ? err.message : 'Erro ao baixar o boleto.');
    } finally {
      setBaixandoId(null);
    }
  };

  const handleAcao = (boleto: Boleto) => {
    if (boleto.provider === 'asaas' && boleto.asaasBoletoUrl) {
      window.open(boleto.asaasBoletoUrl, '_blank', 'noopener,noreferrer');
    } else if (boleto.provider === 'cora' && boleto.coraBoletoUrl) {
      window.open(boleto.coraBoletoUrl, '_blank', 'noopener,noreferrer');
    } else if (boleto.provider === 'local' && boleto.fileName) {
      handleDownloadLocal(boleto);
    }
  };

  const handleCopiar = async (texto: string, tipo: 'código de barras' | 'PIX') => {
    try {
      await navigator.clipboard.writeText(texto);
      mostrarToast('sucesso', `${tipo === 'PIX' ? 'Pix' : 'Código de barras'} copiado!`);
    } catch {
      mostrarToast('erro', `Não foi possível copiar o ${tipo}.`);
    }
  };

  // ── Derivados ──────────────────────────────────────────────────────────────
  const temAcao = (b: Boleto) =>
    (b.provider === 'local' && !!b.fileName) ||
    (b.provider === 'asaas' && !!b.asaasBoletoUrl) ||
    (b.provider === 'cora' && !!b.coraBoletoUrl);

  const barcode = (b: Boleto) => b.asaasBarcode ?? b.coraBarcode ?? null;
  const pixPayload = (b: Boleto) => b.asaasPixCopiaECola ?? b.coraPixPayload ?? null;

  // =============================================================================
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
          <DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Financeiro</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Seus honorários e cobranças
          </p>
        </div>
      </div>

      {/* ── Filtros de status ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
        {FILTROS.map(({ label, valor }) => (
          <button
            key={valor}
            type="button"
            onClick={() => handleFiltro(valor)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border
              ${filtroStatus === valor
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-700 hover:text-sky-700 dark:hover:text-sky-400'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Card principal ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400 dark:text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            Carregando cobranças…
          </div>
        )}

        {/* Erro */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{error}</p>
            <button
              type="button"
              onClick={carregarBoletos}
              className="mt-1 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && boletos.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <DollarSign size={26} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              Sem cobranças encontradas
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
              {filtroStatus
                ? `Nenhum boleto com status "${STATUS_CONFIG[filtroStatus].label}" encontrado.`
                : 'Quando seu contador lançar cobranças, elas aparecerão aqui.'}
            </p>
          </div>
        )}

        {/* Tabela — desktop */}
        {!loading && !error && boletos.length > 0 && (
          <>
            {/* Cabeçalho — visível apenas em sm+ */}
            <div className="hidden sm:grid grid-cols-[1fr_2fr_auto_auto_auto_auto] gap-x-4 px-5 py-3
              bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
              text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <span>Referência</span>
              <span>Descrição</span>
              <span className="text-right">Valor</span>
              <span className="text-center">Vencimento</span>
              <span className="text-center">Status</span>
              <span className="text-right">Ação</span>
            </div>

            <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {boletos.map((boleto) => {
                const cfg        = STATUS_CONFIG[boleto.status];
                const bc         = barcode(boleto);
                const pix        = pixPayload(boleto);
                const isBaixando = baixandoId === boleto.id;

                return (
                  <li
                    key={boleto.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[1fr_2fr_auto_auto_auto_auto] gap-x-4 items-center px-5 py-3.5">
                      {/* Mês de referência */}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                        {formatarMesReferencia(boleto.mesReferencia)}
                      </span>

                      {/* Descrição */}
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {boleto.descricao ?? '—'}
                      </span>

                      {/* Valor */}
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums text-right whitespace-nowrap">
                        {formatarMoeda(boleto.valor)}
                      </span>

                      {/* Vencimento */}
                      <span className="text-sm text-gray-500 dark:text-gray-400 text-center tabular-nums whitespace-nowrap">
                        {formatarData(boleto.vencimento)}
                      </span>

                      {/* Status badge */}
                      <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cfg.badge}`}>
                        {cfg.label}
                      </span>

                      {/* Ações */}
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Botão principal (download / ver boleto) */}
                        {temAcao(boleto) && (
                          <button
                            type="button"
                            onClick={() => handleAcao(boleto)}
                            disabled={isBaixando}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/20
                              hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-700 dark:text-sky-400
                              text-xs font-semibold border border-sky-200 dark:border-sky-800
                              disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            {isBaixando ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : boleto.provider === 'local' ? (
                              <Download size={12} />
                            ) : (
                              <ExternalLink size={12} />
                            )}
                            {boleto.provider === 'local' ? 'Baixar PDF' : 'Ver Boleto'}
                          </button>
                        )}

                        {/* Copiar código de barras */}
                        {bc && (
                          <button
                            type="button"
                            onClick={() => handleCopiar(bc, 'código de barras')}
                            title="Copiar código de barras"
                            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500
                              hover:text-amber-600 dark:hover:text-amber-400
                              hover:bg-amber-50 dark:hover:bg-amber-900/20
                              border border-transparent hover:border-amber-200 dark:hover:border-amber-800
                              transition-colors"
                          >
                            <Copy size={13} />
                          </button>
                        )}

                        {/* Copiar PIX */}
                        {pix && (
                          <button
                            type="button"
                            onClick={() => handleCopiar(pix, 'PIX')}
                            title="Copiar chave PIX"
                            className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500
                              hover:text-emerald-600 dark:hover:text-emerald-400
                              hover:bg-emerald-50 dark:hover:bg-emerald-900/20
                              border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800
                              transition-colors"
                          >
                            <QrCode size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="sm:hidden px-4 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatarMesReferencia(boleto.mesReferencia)}
                          </p>
                          {boleto.descricao && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                              {boleto.descricao}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {formatarMoeda(boleto.valor)}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Venc. {formatarData(boleto.vencimento)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {bc && (
                            <button
                              type="button"
                              onClick={() => handleCopiar(bc, 'código de barras')}
                              title="Copiar código de barras"
                              className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors border border-gray-200 dark:border-gray-700"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                          {pix && (
                            <button
                              type="button"
                              onClick={() => handleCopiar(pix, 'PIX')}
                              title="Copiar chave PIX"
                              className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border border-gray-200 dark:border-gray-700"
                            >
                              <QrCode size={14} />
                            </button>
                          )}
                          {temAcao(boleto) && (
                            <button
                              type="button"
                              onClick={() => handleAcao(boleto)}
                              disabled={isBaixando}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700
                                text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isBaixando ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : boleto.provider === 'local' ? (
                                <Download size={13} />
                              ) : (
                                <ExternalLink size={13} />
                              )}
                              {boleto.provider === 'local' ? 'Baixar' : 'Ver'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700
                    bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400
                    hover:border-sky-300 dark:hover:border-sky-700 hover:text-sky-700 dark:hover:text-sky-400
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700
                    bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400
                    hover:border-sky-300 dark:hover:border-sky-700 hover:text-sky-700 dark:hover:text-sky-400
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full sm:w-auto">
          <div
            className={`flex items-start gap-3 rounded-xl shadow-xl border p-4 pr-3
              bg-white dark:bg-gray-900
              ${toast.tipo === 'sucesso'
                ? 'border-emerald-200 dark:border-emerald-800'
                : 'border-red-200 dark:border-red-800'
              }`}
          >
            {toast.tipo === 'sucesso' ? (
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            )}
            <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{toast.msg}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
