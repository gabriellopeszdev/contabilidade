'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { HardDrive, Download, RefreshCw, AlertTriangle, Database, Clock } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

interface BackupEntry {
  nome:      string;
  categoria: 'daily' | 'weekly' | 'monthly';
  tamanho:   number;
  criadoEm:  string;
}

interface BackupsData {
  backups: BackupEntry[];
}

const CATEGORIA_LABEL: Record<string, string> = {
  daily:   'Diário',
  weekly:  'Semanal',
  monthly: 'Mensal',
};

const CATEGORIA_COR: Record<string, string> = {
  daily:   'text-blue-400 bg-blue-900/30 border-blue-700/50',
  weekly:  'text-violet-400 bg-violet-900/30 border-violet-700/50',
  monthly: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/50',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupsPage() {
  const { token } = useAuth();
  const [baixando, setBaixando] = useState<string | null>(null);

  const { data, isLoading, error, mutate } = useSWR<BackupsData>(
    token ? ['/api/v1/admin/backups', token] : null,
    async ([url, t]: [string, string]) => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error('Erro ao listar backups');
      return res.json();
    },
  );

  async function handleDownload(nome: string) {
    if (!token || baixando) return;
    setBaixando(nome);
    try {
      const res = await fetch(
        `/api/v1/admin/backups/download?file=${encodeURIComponent(nome)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        alert(err.message ?? 'Erro ao baixar backup.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao baixar backup.');
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Backups do Banco</h1>
          <p className="text-sm text-slate-400 mt-0.5">Dumps PostgreSQL gerados automaticamente</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
        >
          <RefreshCw size={13} />
          Atualizar
        </button>
      </div>

      {/* Info */}
      <div className="bg-slate-900 border border-slate-800 border-l-2 border-l-blue-500 rounded-xl p-4">
        <div className="flex gap-3">
          <Database size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">Retenção:</span>{' '}
            7 diários · 4 semanais · 6 mensais. Os arquivos são gerados às 02:00 UTC pelo serviço <code className="text-blue-300 bg-slate-800 px-1 rounded text-xs">pg_backup</code>.
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <HardDrive size={15} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">
            Arquivos disponíveis
            {data && <span className="ml-2 text-slate-500 font-normal">({data.backups.length})</span>}
          </h2>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-violet-500" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle size={28} className="text-red-400" />
            <p className="text-slate-400 text-sm">Erro ao carregar backups.</p>
            <p className="text-slate-500 text-xs">Verifique se o volume /backups está montado no container.</p>
            <button onClick={() => mutate()} className="text-violet-400 text-sm hover:underline">
              Tentar novamente
            </button>
          </div>
        )}

        {!isLoading && !error && data && data.backups.length === 0 && (
          <div className="py-16 text-center text-slate-500 text-sm">
            Nenhum backup encontrado em /backups/daily, /weekly ou /monthly.
          </div>
        )}

        {!isLoading && !error && data && data.backups.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-800">
                <th className="px-5 py-3 font-medium">Arquivo</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Tamanho</th>
                <th className="px-5 py-3 font-medium">
                  <span className="flex items-center gap-1"><Clock size={10} /> Data</span>
                </th>
                <th className="px-5 py-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.backups.map((b) => (
                <tr key={`${b.categoria}/${b.nome}`} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-slate-200 font-mono text-xs">{b.nome}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-[10px] font-semibold border px-2 py-0.5 rounded-full ${CATEGORIA_COR[b.categoria] ?? ''}`}>
                      {CATEGORIA_LABEL[b.categoria] ?? b.categoria}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{formatBytes(b.tamanho)}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(b.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDownload(b.nome)}
                      disabled={baixando === b.nome}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {baixando === b.nome ? (
                        <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      Baixar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
