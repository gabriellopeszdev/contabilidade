'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, AlertCircle, Shield, X, Eye } from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

interface AuditLogDTO {
  id:             string;
  userId:         string;
  userName:       string;
  userEmail:      string;
  escritorioNome: string | null;
  actionType:     string;
  resourceType:   string;
  timestamp:      string;
  ipAddress:      string;
  detailsJson:    unknown;
}

interface ApiResponse {
  logs:       AuditLogDTO[];
  total:      number;
  page:       number;
  totalPages: number;
}

interface EscritorioOption {
  id:    string;
  label: string;
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

function acaoBadge(actionType: string) {
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
// Modal de detalhes
// =============================================================================

function ModalDetalhes({ log, onClose }: { log: AuditLogDTO; onClose: () => void }) {
  const campos = [
    { label: 'ID do registro', value: log.id },
    { label: 'Usuário',        value: `${log.userName} <${log.userEmail}>` },
    { label: 'Escritório',     value: log.escritorioNome ?? '—' },
    { label: 'User ID',        value: log.userId },
    { label: 'Ação',           value: log.actionType },
    { label: 'Recurso',        value: log.resourceType },
    { label: 'IP',             value: log.ipAddress },
    { label: 'Data/Hora',      value: formatarData(log.timestamp) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Detalhes do registro</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Campos */}
        <div className="px-5 py-4 space-y-3">
          {campos.map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-28 shrink-0 pt-0.5">
                {label}
              </span>
              <span className="text-xs text-slate-200 font-mono break-all">{value}</span>
            </div>
          ))}
        </div>

        {/* detailsJson */}
        <div className="px-5 pb-5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Detalhes (JSON)
          </p>
          <pre className="bg-slate-800 rounded-lg p-3 text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-52">
            {JSON.stringify(log.detailsJson, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Página principal
// =============================================================================

export default function AuditoriaPage() {
  const { token } = useAuth();

  const [logs,             setLogs]             = useState<AuditLogDTO[]>([]);
  const [carregando,       setCarregando]       = useState(true);
  const [erro,             setErro]             = useState<string | null>(null);
  const [page,             setPage]             = useState(1);
  const [total,            setTotal]            = useState(0);
  const [totalPages,       setTotalPages]       = useState(1);
  const [filtroAcao,       setFiltroAcao]       = useState('');
  const [filtroEscritorio, setFiltroEscritorio] = useState('');
  const [busca,            setBusca]            = useState('');
  const [buscaInput,       setBuscaInput]       = useState('');
  const [escritorios,      setEscritorios]      = useState<EscritorioOption[]>([]);
  const [logSelecionado,   setLogSelecionado]   = useState<AuditLogDTO | null>(null);

  // ---------------------------------------------------------------------------
  // Carregar lista de escritórios para o dropdown (uma vez ao montar)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/admin/contadores', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { items?: Array<{ id: string; name: string; nomeEscritorio: string | null }> }) => {
        const lista: EscritorioOption[] = (data.items ?? []).map((c) => ({
          id:    c.id,
          label: c.nomeEscritorio ?? c.name,
        }));
        lista.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
        setEscritorios(lista);
      })
      .catch(() => {});
  }, [token]);

  // ---------------------------------------------------------------------------
  // Buscar logs
  // ---------------------------------------------------------------------------
  const buscarLogs = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro(null);

    try {
      const params = new URLSearchParams({ page: String(page), perPage: '50' });
      if (filtroAcao)       params.set('actionType',   filtroAcao);
      if (filtroEscritorio) params.set('escritorioId', filtroEscritorio);
      if (busca)            params.set('userId',        busca);

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
  }, [token, page, filtroAcao, filtroEscritorio, busca]);

  useEffect(() => {
    buscarLogs();
  }, [buscarLogs]);

  const aplicarFiltroAcao = (valor: string) => {
    setFiltroAcao(valor);
    setPage(1);
  };

  const aplicarFiltroEscritorio = (valor: string) => {
    setFiltroEscritorio(valor);
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
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">

        {/* Filtro por escritório */}
        <select
          value={filtroEscritorio}
          onChange={(e) => aplicarFiltroEscritorio(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 min-w-[200px]"
        >
          <option value="">Todos os escritórios</option>
          {escritorios.map((e) => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
        </select>

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

        {/* Busca por User ID */}
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
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

        {erro && (
          <div className="flex items-center gap-3 p-6 text-red-400">
            <AlertCircle size={18} />
            <span className="text-sm">{erro}</span>
          </div>
        )}

        {carregando && !erro && (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Carregando registros...</span>
          </div>
        )}

        {!carregando && !erro && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Usuário</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Escritório</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Ação</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Recurso</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">IP</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Data/Hora</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500 text-sm">
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

                      {/* Escritório */}
                      <td className="px-4 py-3">
                        {log.escritorioNome ? (
                          <span className="text-xs text-slate-300 truncate block max-w-[150px]">{log.escritorioNome}</span>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="px-4 py-3">
                        {acaoBadge(log.actionType)}
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

                      {/* Botão ver detalhes */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setLogSelecionado(log)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-900/20 transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye size={14} />
                        </button>
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

      {/* Modal de detalhes */}
      {logSelecionado && (
        <ModalDetalhes log={logSelecionado} onClose={() => setLogSelecionado(null)} />
      )}
    </div>
  );
}
