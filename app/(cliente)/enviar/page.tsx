'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FileCode2,
  Landmark,
  Receipt,
  Calculator,
  Users,
  FolderOpen,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  FileText,
  ChevronRight,
} from 'lucide-react';

import { useAuth }        from '../../../src/presentation/hooks/useAuth';
import { EnvioLoteModal } from '../../../src/presentation/components/cliente/EnvioLoteModal';

// =============================================================================
// Categorias de documento
// =============================================================================

interface Categoria {
  id:       string;
  label:    string;
  descricao: string;
  exemplos: string;
  icon:     React.ElementType;
  accept:   string;
  cor: {
    gradient: string;
    iconBg:   string;
    iconTxt:  string;
    cardBg:   string;
    cardBorder: string;
    cardHover:  string;
  };
}

const CATEGORIAS: Categoria[] = [
  {
    id:       'xml',
    label:    'Arquivos XML',
    descricao: 'Notas fiscais emitidas ou recebidas',
    exemplos: 'NF-e · NFS-e · CT-e',
    icon:     FileCode2,
    accept:   '.xml',
    cor: {
      gradient:    'from-blue-500 to-blue-600',
      iconBg:      'bg-primary/10 dark:bg-primary/20',
      iconTxt:     'text-primary',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-primary/20 dark:border-primary/20',
      cardHover:   'hover:border-primary hover:shadow-primary/10 dark:hover:border-primary',
    },
  },
  {
    id:       'extratos',
    label:    'Extratos Bancários',
    descricao: 'Movimentação da sua conta bancária',
    exemplos: 'PDF · OFX · CSV',
    icon:     Landmark,
    accept:   '.pdf,.ofx,.csv',
    cor: {
      gradient:    'from-emerald-500 to-emerald-600',
      iconBg:      'bg-emerald-100 dark:bg-emerald-900/40',
      iconTxt:     'text-emerald-600 dark:text-emerald-400',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-emerald-100 dark:border-emerald-900/50',
      cardHover:   'hover:border-emerald-400 hover:shadow-emerald-100 dark:hover:border-emerald-600',
    },
  },
  {
    id:       'despesas',
    label:    'Despesas',
    descricao: 'Comprovantes de pagamentos e gastos',
    exemplos: 'Recibos · Boletos pagos · PDFs',
    icon:     Receipt,
    accept:   '.pdf,.jpg,.jpeg,.png',
    cor: {
      gradient:    'from-orange-500 to-orange-600',
      iconBg:      'bg-orange-100 dark:bg-orange-900/40',
      iconTxt:     'text-orange-600 dark:text-orange-400',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-orange-100 dark:border-orange-900/50',
      cardHover:   'hover:border-orange-400 hover:shadow-orange-100 dark:hover:border-orange-600',
    },
  },
  {
    id:       'impostos',
    label:    'Impostos',
    descricao: 'Guias e comprovantes de tributos',
    exemplos: 'DARF · DAS · GPS · GNRE',
    icon:     Calculator,
    accept:   '.pdf,.xml',
    cor: {
      gradient:    'from-red-500 to-red-600',
      iconBg:      'bg-red-100 dark:bg-red-900/40',
      iconTxt:     'text-red-600 dark:text-red-400',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-red-100 dark:border-red-900/50',
      cardHover:   'hover:border-red-400 hover:shadow-red-100 dark:hover:border-red-600',
    },
  },
  {
    id:       'folha',
    label:    'Folha de Pagamento',
    descricao: 'Documentos de funcionários e RH',
    exemplos: 'Holerites · FGTS · Admissão',
    icon:     Users,
    accept:   '.pdf,.xls,.xlsx',
    cor: {
      gradient:    'from-violet-500 to-violet-600',
      iconBg:      'bg-primary/10 dark:bg-primary/20',
      iconTxt:     'text-primary',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-primary/20 dark:border-primary/20',
      cardHover:   'hover:border-primary hover:shadow-primary/10 dark:hover:border-primary',
    },
  },
  {
    id:       'diversos',
    label:    'Documentos Diversos',
    descricao: 'Outros documentos do seu negócio',
    exemplos: 'Contratos · Alvarás · Qualquer PDF',
    icon:     FolderOpen,
    accept:   '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xml',
    cor: {
      gradient:    'from-slate-500 to-slate-600',
      iconBg:      'bg-slate-100 dark:bg-slate-800',
      iconTxt:     'text-slate-600 dark:text-slate-400',
      cardBg:      'bg-white dark:bg-gray-900',
      cardBorder:  'border-slate-200 dark:border-slate-700',
      cardHover:   'hover:border-slate-400 hover:shadow-slate-100 dark:hover:border-slate-500',
    },
  },
];

interface EnvioRecente {
  id:       string;
  fileName: string;
  fileType: string;
  date:     string;
}

// =============================================================================
// Page
// =============================================================================

export default function EnviarPage() {
  const { token } = useAuth();

  const inputRef         = useRef<HTMLInputElement>(null);
  const [catAtiva, setCatAtiva] = useState<Categoria | null>(null);
  const [arquivosModal,  setArquivosModal]  = useState<File[]>([]);
  const [toast,          setToast]          = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  const [enviosRecentes, setEnviosRecentes] = useState<EnvioRecente[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  const carregarEnvios = useCallback(async () => {
    if (!token) return;
    setLoadingHistorico(true);
    try {
      const res  = await fetch('/api/v1/documentos?page=1&perPage=8', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEnviosRecentes(
        (data.items ?? []).map((d: any) => ({
          id:       d.id,
          fileName: d.fileName,
          fileType: d.fileType,
          date:     d.createdAt,
        })),
      );
    } catch {
      // silencia
    } finally {
      setLoadingHistorico(false);
    }
  }, [token]);

  useEffect(() => { carregarEnvios(); }, [carregarEnvios]);

  // Clique no card — abre o file picker com o accept correto
  const handleCardClick = (cat: Categoria) => {
    setCatAtiva(cat);
    if (inputRef.current) {
      inputRef.current.accept = cat.accept;
      inputRef.current.value  = '';
      inputRef.current.click();
    }
  };

  // Arquivos escolhidos no file picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && catAtiva) {
      setArquivosModal(files);
    }
  };

  const fecharModal = () => setArquivosModal([]);

  const aoEnviarComSucesso = () => {
    fecharModal();
    setToast({ tipo: 'sucesso', msg: 'Documentos enviados! Seu contador já foi notificado.' });
    carregarEnvios();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          O que você precisa enviar?
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Toque na categoria certa e escolha o arquivo — é só isso.
        </p>
      </div>

      {/* Input file oculto — reutilizado por todos os cards */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Grid de categorias */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {CATEGORIAS.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCardClick(cat)}
              className={`
                group relative flex flex-col items-center text-center
                rounded-2xl border-2 p-5 sm:p-6
                transition-all duration-200 cursor-pointer
                hover:shadow-lg hover:-translate-y-0.5 active:scale-95
                ${cat.cor.cardBg} ${cat.cor.cardBorder} ${cat.cor.cardHover}
              `}
            >
              {/* Ícone com gradiente */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110 bg-gradient-to-br ${cat.cor.gradient}`}>
                <Icon size={26} className="text-white" aria-hidden="true" />
              </div>

              {/* Título */}
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1">
                {cat.label}
              </p>

              {/* Descrição */}
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mb-3">
                {cat.descricao}
              </p>

              {/* Exemplos */}
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                {cat.exemplos}
              </p>

              {/* CTA */}
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-gray-400 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                <CloudUpload size={13} aria-hidden="true" />
                Enviar
                <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Aviso informativo */}
      <div className="flex items-start gap-3 rounded-xl bg-primary/10 dark:bg-primary/10 border border-primary/20 px-4 py-3">
        <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-primary dark:text-primary">
          Após enviar, seu contador recebe uma notificação automática. Você não precisa ligar nem mandar mensagem.
        </p>
      </div>

      {/* Histórico */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Clock size={15} className="text-gray-400 dark:text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Seus envios recentes</h3>
        </div>

        {loadingHistorico ? (
          <div className="py-10 flex justify-center">
            <div role="status" aria-label="Carregando" className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin">
              <span className="sr-only">Carregando...</span>
            </div>
          </div>
        ) : enviosRecentes.length === 0 ? (
          <div className="py-12 text-center">
            <CloudUpload size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhum documento enviado ainda</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Toque em uma das categorias acima para enviar seu primeiro documento.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-gray-800">
            {enviosRecentes.map((envio) => {
              const isXML = envio.fileType === 'XML' || envio.fileName.toLowerCase().endsWith('.xml');
              const Icon  = isXML ? FileCode2 : FileText;
              const cor   = isXML ? 'from-sky-500 to-sky-600' : 'from-red-500 to-red-600';
              return (
                <li
                  key={envio.id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${cor}`}>
                    <Icon size={15} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{envio.fileName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(envio.date).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    A categorizar
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal de envio */}
      {arquivosModal.length > 0 && (
        <EnvioLoteModal
          arquivos={arquivosModal}
          categoriaId={catAtiva?.id}
          onFechar={fecharModal}
          onSucesso={aoEnviarComSucesso}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm" style={{ animation: 'fadeInUp 0.3s ease both' }}>
          <div className={`flex items-start gap-3 rounded-xl shadow-xl border p-4 pr-3 bg-white dark:bg-gray-900
            ${toast.tipo === 'sucesso' ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'}`}
          >
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle  size={18} className="text-red-500 shrink-0 mt-0.5" />
            }
            <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{toast.msg}</p>
            <button type="button" onClick={() => setToast(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
