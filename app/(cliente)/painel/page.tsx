'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Send, Bell, DollarSign, CalendarClock,
  FileText, Download, Loader2, CheckCircle2,
  TrendingUp,
} from 'lucide-react';

import { toast } from 'sonner';
import { useAuth }               from '../../../src/presentation/hooks/useAuth';
import { useDocumentosCliente }  from '../../../src/presentation/hooks/useDocumentosCliente';
import { ClienteDashboardCharts } from '../../../src/presentation/components/dashboard/ClienteDashboardCharts';

// =============================================================================
// Tipos
// =============================================================================

interface Boleto {
  id:            string;
  valor:         number;
  vencimento:    string;
  status:        string;
  descricao?:    string;
  mesReferencia?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// =============================================================================
// Página /painel — Dashboard do Cliente
// =============================================================================

export default function PainelPage() {
  const router = useRouter();
  const { usuario, token, carregando: authCarregando, isCliente, isFuncionarioCliente } = useAuth();

  useEffect(() => {
    if (authCarregando) return;
    if (!usuario || (!isCliente && !isFuncionarioCliente)) router.push('/login');
  }, [authCarregando, usuario, isCliente, isFuncionarioCliente, router]);

  // ── Documentos ─────────────────────────────────────────────────────────────
  const { documentos, carregando: docsCarregando } = useDocumentosCliente({ initialPerPage: 50 });

  // ── Boletos ─────────────────────────────────────────────────────────────────
  const [boletos,           setBoletos]           = useState<Boleto[]>([]);
  const [boletosCarregando, setBoletosCarregando] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/financeiro/boletos?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setBoletos(d.boletos ?? []))
      .catch(() => toast.error('Não foi possível carregar seus boletos. Tente recarregar a página.'))
      .finally(() => setBoletosCarregando(false));
  }, [token]);

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const agora = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const enviadosMes = useMemo(() => {
    const mes = agora.getMonth(); const ano = agora.getFullYear();
    return documentos.filter(d => {
      if (d.origem !== 'UPLOAD_CLIENTE') return false;
      const dt = new Date(d.createdAt);
      return dt.getMonth() === mes && dt.getFullYear() === ano;
    }).length;
  }, [documentos, agora]);

  const novosDoContador = useMemo(
    () => documentos.filter(d => d.origem === 'UPLOAD_CONTADOR' && !d.readStatus).length,
    [documentos],
  );

  const boletosAbertos = useMemo(
    () => boletos.filter(b => b.status === 'PENDENTE' || b.status === 'VENCIDO'),
    [boletos],
  );

  const boletosVencidos = useMemo(
    () => boletosAbertos.filter(b => {
      const d = new Date(b.vencimento); d.setHours(0, 0, 0, 0); return d < agora;
    }),
    [boletosAbertos, agora],
  );

  const valorAberto = useMemo(
    () => boletosAbertos.reduce((s, b) => s + b.valor, 0),
    [boletosAbertos],
  );

  const proximoVencimento = useMemo(() => {
    const futuros = boletos
      .filter(b => b.status === 'PENDENTE')
      .map(b => { const d = new Date(b.vencimento); d.setHours(0, 0, 0, 0); return d; })
      .filter(d => d >= agora)
      .sort((a, b) => a.getTime() - b.getTime());
    return futuros[0] ?? null;
  }, [boletos, agora]);

  const diasAteVencer = proximoVencimento
    ? Math.ceil((proximoVencimento.getTime() - agora.getTime()) / 86_400_000)
    : null;

  const atividadeRecente = useMemo(
    () => [...documentos]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8),
    [documentos],
  );

  const boletosPendentes = useMemo(
    () => [...boletosAbertos]
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
      .slice(0, 5),
    [boletosAbertos],
  );

  // ── Guard ───────────────────────────────────────────────────────────────────
  if (authCarregando || !usuario) return null;

  // ============================================================================
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

        {/* Enviados este mês */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <Send size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {docsCarregando ? '—' : enviadosMes}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 leading-tight">Enviados este mês</p>
            </div>
          </div>
        </div>

        {/* Não lidos do contador */}
        <div className={`rounded-2xl border p-4 sm:p-5 ${
          novosDoContador > 0
            ? 'bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
              novosDoContador > 0 ? 'bg-primary/20' : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              <Bell size={16} className={novosDoContador > 0 ? 'text-primary' : 'text-gray-400 dark:text-gray-500'} />
            </div>
            <div className="min-w-0">
              <p className={`text-xl sm:text-2xl font-bold leading-tight ${
                novosDoContador > 0 ? 'text-primary-dark dark:text-primary' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {docsCarregando ? '—' : novosDoContador}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 leading-tight">Não lidos</p>
            </div>
          </div>
        </div>

        {/* Boletos em aberto */}
        <div className={`rounded-2xl border p-4 sm:p-5 ${
          boletosVencidos.length > 0
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : boletosAbertos.length > 0
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
              boletosVencidos.length > 0 ? 'bg-red-100 dark:bg-red-900/30' :
              boletosAbertos.length > 0 ? 'bg-amber-100 dark:bg-amber-900/30' :
              'bg-gray-100 dark:bg-gray-800'
            }`}>
              <DollarSign size={16} className={
                boletosVencidos.length > 0 ? 'text-red-500' :
                boletosAbertos.length > 0 ? 'text-amber-500' :
                'text-gray-400 dark:text-gray-500'
              } />
            </div>
            <div className="min-w-0">
              <p className={`text-base sm:text-xl font-bold truncate leading-tight ${
                boletosVencidos.length > 0 ? 'text-red-700 dark:text-red-400' :
                boletosAbertos.length > 0 ? 'text-amber-700 dark:text-amber-400' :
                'text-gray-900 dark:text-gray-100'
              }`}>
                {boletosCarregando ? '—' : boletosAbertos.length > 0 ? formatarMoeda(valorAberto) : 'R$ 0'}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 leading-tight">
                {boletosVencidos.length > 0
                  ? `${boletosVencidos.length} vencido${boletosVencidos.length > 1 ? 's' : ''}`
                  : boletosAbertos.length > 0
                    ? `${boletosAbertos.length} em aberto`
                    : 'Sem boletos'}
              </p>
            </div>
          </div>
        </div>

        {/* Próximo vencimento */}
        <div className={`rounded-2xl border p-4 sm:p-5 ${
          diasAteVencer !== null && diasAteVencer <= 5
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
              diasAteVencer !== null && diasAteVencer <= 5
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              <CalendarClock size={16} className={
                diasAteVencer !== null && diasAteVencer <= 5 ? 'text-amber-500' : 'text-primary'
              } />
            </div>
            <div className="min-w-0">
              <p className={`text-xl sm:text-2xl font-bold leading-tight ${
                diasAteVencer !== null && diasAteVencer <= 5
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {boletosCarregando
                  ? '—'
                  : diasAteVencer === null
                    ? '—'
                    : diasAteVencer === 0
                      ? 'Hoje'
                      : `${diasAteVencer}d`}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 leading-tight">
                {proximoVencimento
                  ? `Venc. ${formatarData(proximoVencimento.toISOString())}`
                  : 'Próx. vencimento'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gráficos ───────────────────────────────────────────────────────── */}
      <ClienteDashboardCharts token={token} />

      {/* ── Atividade + Boletos ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Atividade Recente */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Atividade Recente</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Últimos documentos</p>
            </div>
            <Link
              href="/documentos"
              className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
            >
              Ver todos <TrendingUp size={12} />
            </Link>
          </div>

          {docsCarregando ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400 dark:text-gray-500">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Carregando…
            </div>
          ) : atividadeRecente.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center flex-1">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <FileText size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum documento ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {atividadeRecente.map(doc => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    doc.origem === 'UPLOAD_CLIENTE'
                      ? 'bg-emerald-100 dark:bg-emerald-900/30'
                      : 'bg-primary/10 dark:bg-primary/20'
                  }`}>
                    {doc.origem === 'UPLOAD_CLIENTE'
                      ? <Send size={13} className="text-emerald-600 dark:text-emerald-400" />
                      : <Download size={13} className="text-primary" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${
                      !doc.readStatus && doc.origem === 'UPLOAD_CONTADOR'
                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {doc.fileName}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {doc.origem === 'UPLOAD_CLIENTE' ? 'Enviado por você' : 'Do seu contador'}
                      {' · '}{formatarData(doc.createdAt)}
                    </p>
                  </div>
                  {!doc.readStatus && doc.origem === 'UPLOAD_CONTADOR' && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary text-white leading-none">
                      NOVO
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Boletos Pendentes */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Boletos Pendentes</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Em aberto e vencidos</p>
            </div>
            <Link
              href="/financeiro"
              className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
            >
              Ver todos <TrendingUp size={12} />
            </Link>
          </div>

          {boletosCarregando ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400 dark:text-gray-500">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Carregando…
            </div>
          ) : boletosPendentes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 size={18} className="text-emerald-500" />
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum boleto pendente.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {boletosPendentes.map(b => {
                const venc = new Date(b.vencimento);
                venc.setHours(0, 0, 0, 0);
                const vencido = venc < agora;
                return (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      vencido ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                    }`}>
                      <DollarSign size={13} className={vencido ? 'text-red-500' : 'text-amber-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {b.descricao ?? b.mesReferencia ?? 'Boleto'}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        Venc. {formatarData(b.vencimento)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${
                        vencido ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {formatarMoeda(b.valor)}
                      </p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${
                        vencido
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      }`}>
                        {vencido ? 'VENCIDO' : 'EM ABERTO'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
