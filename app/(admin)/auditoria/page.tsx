'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, AlertCircle, Shield } from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface AuditLogDTO {
  id:           string;
  userId:       string;
  userName:     string;
  userEmail:    string;
  actionType:   string;
  resourceType: string;
  timestamp:    string;
  ipAddress:    string;
  detailsJson:  unknown;
}

interface ApiResponse {
  logs:       AuditLogDTO[];
  total:      number;
  page:       number;
  totalPages: number;
}

// =============================================================================
// Constantes
// =============================================================================

const ACTION_TYPES = [
  { value: '',              label: 'Todas as ações' },
  { value: 'LOGIN',         label: 'Login' },
  { value: 'LOGOUT',        label: 'Logout' },
  { value: 'DOWNLOAD',      label: 'Download' },
  { value: 'UPLOAD_BATCH',  label: 'Upload em lote' },
  { value: 'VIEW',          label: 'Visualização' },
  { value: 'STATE_CHANGE',  label: 'Mudança de estado' },
];

const RESOURCE_LABELS: Record<string, string> = {
  DOCUMENT:    'Documento',
  TASK:        'Tarefa',
  USER:        'Usuário',
  SESSION:     'Sessão',
  OFFBOARDING: 'Offboarding',
  BOLETO:      'Boleto',
  ASSINATURA:  'Assinatura',
};

// =============================================================================
// Helpers
// =============================================================================

function formatarData(iso: string): string {
  try {
    const d = new Date(iso);
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

function acao_badge(actionType: string) {
  const colors: Record<string, string> = {
    LOGIN:        'text-emerald-400 bg-emerald-900/30 border-emerald-700/40',
    LOGOUT:       'text-slate-400  bg-slate-800/50    border-slate-700/40',
    DOWNLOAD:     'text-primary    bg-primary/20      border-primary/30',
    UPLOAD_BATCH: 'text-violet-400 bg-violet-900/30   border-violet-700/40',
    VIEW:         'text-amber-400  bg-amber-900/30    border-amber-700/40',
    STATE_CHANGE: 'text-orange-400 bg-orange-900/30   border-orange-700/40',
  };
  const cls = colors[actionType] ?? 'text-slate-300 bg-slate-800/50 border-slate-700/40';
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {actionType.replace('_', ' ')}
    </span>
  );
}

// =============================================================================
// Página principal
// =============================================================================

export default function AuditoriaPage() {
  const { token } = useAuth();

  const [logs,       setLogs]       = useState<AuditLogDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filtroAcao, setFiltroAcao] = useState('');
  const [busca,      setBusca]      = useState('');
  const [buscaInput, setBuscaInput] = useState('');

  // ---------------------------------------------------------------------------
  // Buscar logs
  // ---------------------------------------------------------------------------
  const buscarLogs = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro(null);

    try {
      const params = new URLSearchParams({ page: String(page), perPage: '50' });
      if (filtroAcao) params.set('actionType', filtroAcao);
      if (busca)      params.set('userId', busca);

      const res = await fetch(`/api/v1/admin/audit-log?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Erro ${res.status}`);
      }

      const data: ApiResponse = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido.');
    } finally {
      setCarregando(false);
    }
  }, [token, page, filtroAcao, busca]);

  useEffect(() => {
    buscarLogs();
  }, [buscarLogs]);

  // Resetar página ao mudar filtros
  const aplicarFiltroAcao = (valor: string) => {
    setFiltroAcao(valor);
    setPage(1);
  };

  const aplicarBusca = () => {
    setBusca(buscaInput.trim());
    setPage(1);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-700/40 flex items-center justify-center">
          <Shield size={20} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Log de Auditoria</h1>
          <p className="text-xs text-slate-400">
            {total > 0 ? `${total.toLocaleString('pt-BR')} registros encontrados` : 'Nenhum registro'}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Busca por userId */}
        <div className="flex flex-1 max-w-sm gap-2">
          <input
            type="text"
            placeholder="Filtrar por User ID..."
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aplicarBusca()}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
          />
          <button
            onClick={aplicarBusca}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            title="Buscar"
          >
            <Search size={16} />
          </button>
        </div>

        {/* Filtro de ação */}
        <select
          value={filtroAcao}
          onChange={(e) => aplicarFiltroAcao(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
        >
          {ACTION_TYPES.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

        {/* Estado: erro */}
        {erro && (
          <div className="flex items-center gap-3 p-6 text-red-400">
            <AlertCircle size={18} />
            <span className="text-sm">{erro}</span>
          </div>
        )}

        {/* Estado: carregando */}
        {carregando && !erro && (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Carregando registros...</span>
          </div>
        )}

        {/* Tabela de logs */}
        {!carregando && !erro && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Usuário</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Ação</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Recurso</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">IP</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Data/Hora</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                      Nenhum registro encontrado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Usuário */}
                      <td className="px-4 py-3">
                        <p className="text-slate-100 font-medium text-xs truncate max-w-[160px]">{log.userName}</p>
                        <p className="text-slate-500 text-[11px] truncate max-w-[160px]">{log.userEmail}</p>
                      </td>

                      {/* Ação */}
                      <td className="px-4 py-3">
                        {acao_badge(log.actionType)}
                      </td>

                      {/* Recurso */}
                      <td className="px-4 py-3 text-slate-300 text-xs">
                        {RESOURCE_LABELS[log.resourceType] ?? log.resourceType}
                      </td>

                      {/* IP */}
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                        {log.ipAddress}
                      </td>

                      {/* Data/Hora */}
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {formatarData(log.timestamp)}
                      </td>

                      {/* Detalhes */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <span
                          className="text-[11px] text-slate-500 font-mono truncate block"
                          title={JSON.stringify(log.detailsJson)}
                        >
                          {JSON.stringify(log.detailsJson).slice(0, 60)}
                          {JSON.stringify(log.detailsJson).length > 60 ? '…' : ''}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {!carregando && !erro && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
