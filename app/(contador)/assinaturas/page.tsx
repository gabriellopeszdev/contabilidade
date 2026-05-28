'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileSignature, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink, Filter } from 'lucide-react';

type StatusAssinatura = 'TODOS' | 'PENDENTE' | 'ASSINADO' | 'RECUSADO' | 'EXPIRADO';

interface Assinatura {
  id:              string;
  status:          string;
  signatarioNome:  string;
  signatarioEmail: string;
  expiresAt:       string;
  assinadoAt:      string | null;
  motivoRecusa:    string | null;
  createdAt:       string;
  tokenAssinatura: string;
  documentoId:     string;
  documentoNome:   string;
  documentoTipo:   string;
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; icon: React.ReactNode }> = {
  PENDENTE:  { label: 'Pendente',  cor: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Clock size={12} /> },
  ASSINADO:  { label: 'Assinado',  cor: 'bg-green-100  text-green-800  border-green-200',  icon: <CheckCircle2 size={12} /> },
  RECUSADO:  { label: 'Recusado',  cor: 'bg-red-100    text-red-800    border-red-200',    icon: <XCircle size={12} /> },
  EXPIRADO:  { label: 'Expirado',  cor: 'bg-gray-100   text-gray-600   border-gray-200',  icon: <AlertCircle size={12} /> },
};

const FILTROS: { value: StatusAssinatura; label: string }[] = [
  { value: 'TODOS',    label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendentes' },
  { value: 'ASSINADO', label: 'Assinados' },
  { value: 'RECUSADO', label: 'Recusados' },
  { value: 'EXPIRADO', label: 'Expirados' },
];

export default function AssinaturasPage() {
  const [filtro, setFiltro]           = useState<StatusAssinatura>('TODOS');
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [carregando, setCarregando]   = useState(true);
  const [erro, setErro]               = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const params = filtro !== 'TODOS' ? `?status=${filtro}` : '';
      const res = await fetch(`/api/v1/assinaturas${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { assinaturas: Assinatura[] };
      setAssinaturas(data.assinaturas);
    } catch {
      setErro('Erro ao carregar assinaturas. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirLinkAssinatura(token: string) {
    const appUrl = window.location.origin;
    window.open(`${appUrl}/assinar/${token}`, '_blank');
  }

  const counts = assinaturas.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <FileSignature size={24} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assinaturas</h1>
            <p className="text-sm text-gray-500">Gerencie solicitações de assinatura eletrônica</p>
          </div>
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['PENDENTE', 'ASSINADO', 'RECUSADO', 'EXPIRADO'] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFiltro(filtro === s ? 'TODOS' : s)}
              className={`p-4 rounded-xl border text-left transition-all ${
                filtro === s ? 'ring-2 ring-blue-500 ' + cfg.cor : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900">{counts[s] ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">{cfg.label}{(counts[s] ?? 0) !== 1 ? 's' : ''}</div>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Estado de carregamento */}
      {carregando && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      )}

      {/* Erro */}
      {erro && !carregando && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{erro}</div>
      )}

      {/* Vazio */}
      {!carregando && !erro && assinaturas.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FileSignature size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma solicitação de assinatura encontrada</p>
          <p className="text-xs mt-1">As solicitações aparecem aqui quando você pede assinatura de um documento</p>
        </div>
      )}

      {/* Tabela */}
      {!carregando && assinaturas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-left">Signatário</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Enviado em</th>
                  <th className="px-4 py-3 text-left">Vencimento</th>
                  <th className="px-4 py-3 text-left">Conclusão</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assinaturas.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.EXPIRADO;
                  const vencido = a.status === 'PENDENTE' && new Date(a.expiresAt) < new Date();
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 truncate max-w-[200px]">{a.documentoNome}</p>
                        <p className="text-xs text-gray-400">{a.documentoTipo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-800">{a.signatarioNome}</p>
                        <p className="text-xs text-gray-400">{a.signatarioEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cor}`}>
                          {cfg.icon}{cfg.label}
                        </span>
                        {a.motivoRecusa && (
                          <p className="text-xs text-gray-400 mt-1 max-w-[150px] truncate" title={a.motivoRecusa}>
                            {a.motivoRecusa}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(a.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={vencido ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {new Date(a.expiresAt).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {a.assinadoAt ? new Date(a.assinadoAt).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(a.status === 'PENDENTE' || a.status === 'EXPIRADO') && (
                          <button
                            onClick={() => abrirLinkAssinatura(a.tokenAssinatura)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <ExternalLink size={12} />
                            Ver link
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {assinaturas.length} solicitaç{assinaturas.length !== 1 ? 'ões' : 'ão'}
          </div>
        </div>
      )}
    </div>
  );
}
