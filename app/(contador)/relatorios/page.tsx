'use client';

import { useState } from 'react';
import { FileText, Download, Table, Loader2, FileBarChart, DollarSign, Users } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

type Formato = 'pdf' | 'excel';
type AbaId   = 'documentos' | 'financeiro' | 'clientes';

interface Coluna { label: string; key: string }

const ABAS: { id: AbaId; label: string; icon: React.ReactNode; descricao: string; endpoint: string; colunas: Coluna[] }[] = [
  {
    id: 'documentos',
    label: 'Documentos Fiscais',
    icon: <FileText size={16} />,
    descricao: 'Lista completa de documentos enviados por clientes',
    endpoint: '/api/v1/relatorios/documentos',
    colunas: [
      { label: 'Arquivo', key: 'fileName' },
      { label: 'Tipo', key: 'fileType' },
      { label: 'Setor', key: 'sector' },
      { label: 'Competência', key: 'competencia' },
      { label: 'Lido', key: 'lido' },
      { label: 'Enviado em', key: 'createdAt' },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro / Boletos',
    icon: <DollarSign size={16} />,
    descricao: 'Histórico de cobranças e status de pagamento',
    endpoint: '/api/v1/relatorios/financeiro',
    colunas: [
      { label: 'Cliente', key: 'cliente' },
      { label: 'Valor', key: 'valor' },
      { label: 'Vencimento', key: 'vencimento' },
      { label: 'Status', key: 'status' },
      { label: 'Mês Ref.', key: 'mesReferencia' },
      { label: 'Emitido em', key: 'createdAt' },
    ],
  },
  {
    id: 'clientes',
    label: 'Carteira de Clientes',
    icon: <Users size={16} />,
    descricao: 'Lista de clientes do escritório com dados de contato',
    endpoint: '/api/v1/relatorios/clientes',
    colunas: [
      { label: 'Nome', key: 'name' },
      { label: 'CNPJ', key: 'cnpj' },
      { label: 'Email', key: 'email' },
      { label: 'Telefone', key: 'phone' },
      { label: 'Ativo', key: 'ativo' },
      { label: 'Desde', key: 'assignedAt' },
    ],
  },
];

export default function RelatoriosPage() {
  const { getToken } = useAuth();
  const [abaAtiva, setAbaAtiva]           = useState<AbaId>('documentos');
  const [de, setDe]                       = useState('');
  const [ate, setAte]                     = useState('');
  const [dados, setDados]                 = useState<Record<string, string>[]>([]);
  const [total, setTotal]                 = useState(0);
  const [carregando, setCarregando]       = useState(false);
  const [erro, setErro]                   = useState('');
  const [visualizando, setVisualizando]   = useState(false);

  const aba = ABAS.find((a) => a.id === abaAtiva)!;

  function buildUrl(formato: string) {
    const params = new URLSearchParams({ format: formato });
    if (de)  params.set('de', de);
    if (ate) params.set('ate', ate);
    return `${aba.endpoint}?${params}`;
  }

  async function exportar(formato: Formato) {
    const token = await getToken();
    const url = buildUrl(formato);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const ext  = formato === 'pdf' ? 'pdf' : 'xlsx';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-${abaAtiva}.${ext}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function previsualizarDados() {
    setCarregando(true);
    setErro('');
    setVisualizando(true);
    try {
      const token = await getToken();
      const res = await fetch(buildUrl('json'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Erro ao carregar dados');
      const json = await res.json() as { total: number; dados: Record<string, string>[] };
      setDados(json.dados);
      setTotal(json.total);
    } catch {
      setErro('Não foi possível carregar os dados. Tente novamente.');
      setVisualizando(false);
    } finally {
      setCarregando(false);
    }
  }

  function trocarAba(id: AbaId) {
    setAbaAtiva(id);
    setDados([]);
    setTotal(0);
    setVisualizando(false);
    setErro('');
  }

  const STATUS_CORES: Record<string, string> = {
    PENDENTE:  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
    PAGO:      'bg-green-100  dark:bg-green-900/30  text-green-800  dark:text-green-400',
    VENCIDO:   'bg-red-100    dark:bg-red-900/30    text-red-800    dark:text-red-400',
    CANCELADO: 'bg-gray-100   dark:bg-gray-700      text-gray-600   dark:text-gray-400',
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <FileBarChart size={24} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Relatórios</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Visualize, filtre e exporte dados do escritório</p>
        </div>
      </div>

      {/* Abas */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => trocarAba(a.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                abaAtiva === a.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filtros + ações */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{aba.descricao}</p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">De</label>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="input text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Até</label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="input text-sm"
            />
          </div>

          <button
            onClick={previsualizarDados}
            disabled={carregando}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {carregando ? <Loader2 size={14} className="animate-spin" /> : <Table size={14} />}
            Visualizar dados
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => exportar('pdf')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              <Download size={14} />
              PDF
            </button>
            <button
              onClick={() => exportar('excel')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download size={14} />
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      {/* Tabela de preview */}
      {visualizando && !carregando && dados.length === 0 && !erro && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
          Nenhum registro encontrado para os filtros selecionados.
        </div>
      )}

      {dados.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {total.toLocaleString('pt-BR')} registro{total !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">Máximo 5.000 linhas exibidas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  {aba.colunas.map((c) => (
                    <th key={c.key} className="px-4 py-3 text-left whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {dados.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    {aba.colunas.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {c.key === 'status' && STATUS_CORES[row[c.key]]
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CORES[row[c.key]]}`}>{row[c.key]}</span>
                          : row[c.key] ?? '-'
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
