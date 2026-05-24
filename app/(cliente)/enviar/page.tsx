'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone }                       from 'react-dropzone';
import {
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  FileText,
  FileCode2,
  Receipt,
  Users,
  BarChart3,
} from 'lucide-react';

import { useAuth }        from '../../../src/presentation/hooks/useAuth';
import { EnvioLoteModal } from '../../../src/presentation/components/cliente/EnvioLoteModal';

// =============================================================================
// Tipos e constantes
// =============================================================================

type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const SETORES: {
  value:    SetorTipo;
  label:    string;
  desc:     string;
  exemplos: string;
  Icon:     React.ElementType;
  styles: {
    idle:   string;
    active: string;
    icon:   string;
  };
}[] = [
  {
    value:    'FISCAL',
    label:    'Fiscal',
    desc:     'Notas fiscais e obrigações tributárias',
    exemplos: 'NF-e, DANFE, DARF, DAS, GPS, GNRE',
    Icon:     Receipt,
    styles: {
      idle:   'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-300 hover:bg-indigo-50/40',
      active: 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200',
      icon:   'bg-indigo-100 text-indigo-600',
    },
  },
  {
    value:    'PESSOAL',
    label:    'Dep. Pessoal',
    desc:     'Documentos de funcionários e RH',
    exemplos: 'Admissão, demissão, férias, holerite, FGTS',
    Icon:     Users,
    styles: {
      idle:   'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-violet-300 hover:bg-violet-50/40',
      active: 'border-violet-500 bg-violet-50 ring-2 ring-violet-200',
      icon:   'bg-violet-100 text-violet-600',
    },
  },
  {
    value:    'CONTABIL',
    label:    'Contábil',
    desc:     'Demonstrativos e conciliações',
    exemplos: 'Balanço, DRE, extrato bancário, conciliação',
    Icon:     BarChart3,
    styles: {
      idle:   'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-teal-300 hover:bg-teal-50/40',
      active: 'border-teal-500 bg-teal-50 ring-2 ring-teal-200',
      icon:   'bg-teal-100 text-teal-600',
    },
  },
];

const SETOR_COR: Record<string, string> = {
  FISCAL:   'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  PESSOAL:  'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  CONTABIL: 'bg-teal-50   text-teal-700   ring-1 ring-teal-200',
};

const SETOR_LABEL: Record<string, string> = {
  FISCAL:   'Fiscal',
  PESSOAL:  'Dep. Pessoal',
  CONTABIL: 'Contábil',
};

interface EnvioRecente {
  id:       string;
  fileName: string;
  sector:   string;
  date:     string;
}

// =============================================================================
// EnviarPage
// =============================================================================

export default function EnviarPage() {
  const { token } = useAuth();

  // ── Setor pré-selecionado ────────────────────────────────────────────────────
  const [setorSelecionado, setSetorSelecionado] = useState<SetorTipo>('FISCAL');

  // ── Modal ────────────────────────────────────────────────────────────────────
  const [arquivosModal, setArquivosModal] = useState<File[]>([]);
  const modalAberto = arquivosModal.length > 0;

  // ── Rejeições ────────────────────────────────────────────────────────────────
  const [rejeicoes, setRejeicoes] = useState<{ name: string; motivo: string }[]>([]);

  // ── Histórico de envios ──────────────────────────────────────────────────────
  const [enviosRecentes,  setEnviosRecentes]  = useState<EnvioRecente[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  const carregarEnvios = useCallback(async () => {
    if (!token) return;
    setLoadingHistorico(true);
    try {
      const res  = await fetch('/api/v1/documentos?page=1&perPage=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEnviosRecentes(
        (data.items ?? []).map((d: any) => ({
          id:       d.id,
          fileName: d.fileName,
          sector:   d.sector,
          date:     d.createdAt,
        })),
      );
    } catch {
      // silencia — não é crítico
    } finally {
      setLoadingHistorico(false);
    }
  }, [token]);

  useEffect(() => { carregarEnvios(); }, [carregarEnvios]);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  // ── react-dropzone ───────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    const novasRejeicoes = rejected.map((r) => ({
      name:   r.file.name as string,
      motivo: r.errors[0]?.code === 'file-too-large'
        ? 'Arquivo excede 10 MB'
        : r.errors[0]?.code === 'file-invalid-type'
          ? 'Formato não suportado (apenas PDF/XML)'
          : r.errors[0]?.message ?? 'Arquivo inválido',
    }));
    setRejeicoes(novasRejeicoes);
    if (accepted.length > 0) setArquivosModal(accepted);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/xml': ['.xml'],
      'text/xml':        ['.xml'],
    },
    maxSize:  MAX_SIZE_BYTES,
    multiple: true,
  });

  const fecharModal       = useCallback(() => setArquivosModal([]), []);
  const aoEnviarComSucesso = useCallback(() => {
    fecharModal();
    setToast({ tipo: 'sucesso', msg: 'Documentos enviados! Seu contador já foi notificado.' });
    carregarEnvios();
  }, [fecharModal, carregarEnvios]);

  // ── Estilo do Dropzone ───────────────────────────────────────────────────────
  const setorAtual = SETORES.find((s) => s.value === setorSelecionado)!;

  const dropzoneClasses = [
    'relative rounded-2xl border-2 border-dashed cursor-pointer select-none',
    'transition-all duration-200 flex flex-col items-center justify-center',
    'p-12 sm:p-16 text-center min-h-[260px]',
    isDragReject
      ? 'border-red-400 bg-red-50'
      : isDragActive
        ? 'border-sky-400 bg-sky-50 scale-[1.01] shadow-lg'
        : `border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:shadow-md ${
            setorSelecionado === 'FISCAL'   ? 'hover:border-indigo-400 hover:bg-indigo-50/30' :
            setorSelecionado === 'PESSOAL'  ? 'hover:border-violet-400 hover:bg-violet-50/30' :
                                              'hover:border-teal-400 hover:bg-teal-50/30'
          }`,
  ].join(' ');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Enviar Arquivo</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Selecione o setor, depois arraste ou escolha os documentos.
        </p>
      </div>

      {/* ── Passo 1: Seleção de Setor ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
          1. Para qual setor é este envio?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SETORES.map(({ value, label, desc, exemplos, Icon, styles }) => {
            const ativo = setorSelecionado === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSetorSelecionado(value)}
                className={`
                  relative text-left rounded-2xl border-2 p-4 transition-all
                  focus-visible:outline-none
                  ${ativo ? styles.active : styles.idle}
                `}
              >
                {/* Ícone */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${styles.icon}`}>
                  <Icon size={20} />
                </div>

                {/* Texto */}
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{desc}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 leading-relaxed">{exemplos}</p>

                {/* Indicador de seleção */}
                {ativo && (
                  <CheckCircle2
                    size={16}
                    className="absolute top-3 right-3 text-current opacity-70"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Passo 2: Dropzone ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
          2. Arraste os arquivos ou clique para selecionar
        </p>

        <div {...getRootProps()} className={dropzoneClasses}>
          <input {...getInputProps()} />

          {/* Ícone central */}
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-colors
            ${isDragReject
              ? 'bg-red-100'
              : isDragActive
                ? 'bg-sky-100'
                : setorAtual.styles.icon.split(' ')[0]   // bg-* da cor do setor
            }`}
          >
            <CloudUpload
              size={40}
              className={
                isDragReject ? 'text-red-500' :
                isDragActive ? 'text-sky-500' :
                setorAtual.styles.icon.split(' ')[1]    // text-* da cor do setor
              }
            />
          </div>

          {isDragReject ? (
            <>
              <p className="text-base font-semibold text-red-700">Formato não suportado</p>
              <p className="text-sm text-red-500 mt-1">Apenas arquivos PDF e XML são aceitos.</p>
            </>
          ) : isDragActive ? (
            <>
              <p className="text-base font-semibold text-sky-700">
                Solte para enviar para {setorAtual.label}!
              </p>
              <p className="text-sm text-sky-500 mt-1">Todos os arquivos serão adicionados.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Arraste seus documentos de{' '}
                <span className={
                  setorSelecionado === 'FISCAL'  ? 'text-indigo-600' :
                  setorSelecionado === 'PESSOAL' ? 'text-violet-600' :
                  'text-teal-600'
                }>
                  {setorAtual.label}
                </span>{' '}aqui
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                ou{' '}
                <span className="text-sky-600 underline underline-offset-2 font-medium">
                  clique para procurar no computador
                </span>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                PDF ou XML · Máximo 10 MB por arquivo · Múltiplos arquivos aceitos
              </p>
            </>
          )}
        </div>
      </div>

      {/* Avisos de rejeição */}
      {rejeicoes.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
            <AlertCircle size={13} />
            {rejeicoes.length} arquivo{rejeicoes.length > 1 ? 's' : ''} rejeitado{rejeicoes.length > 1 ? 's' : ''}:
          </p>
          {rejeicoes.map((r, i) => (
            <p key={i} className="text-xs text-red-600">
              <span className="font-medium">{r.name}</span> — {r.motivo}
            </p>
          ))}
        </div>
      )}

      {/* ── Histórico de envios ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
          <Clock size={15} className="text-gray-400 dark:text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Enviados por mim</h3>
        </div>

        {loadingHistorico ? (
          <div className="py-10 flex justify-center">
            <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : enviosRecentes.length === 0 ? (
          <div className="py-10 text-center">
            <CloudUpload size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum documento enviado ainda.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Use a área acima para enviar seu primeiro documento.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-gray-800">
            {enviosRecentes.map((envio) => {
              const isPDF = envio.fileName.toLowerCase().endsWith('.pdf');
              return (
                <li
                  key={envio.id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    {isPDF
                      ? <FileText  size={14} className="text-red-400" />
                      : <FileCode2 size={14} className="text-sky-400" />
                    }
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
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0
                    ${SETOR_COR[envio.sector] ?? 'bg-gray-100 text-gray-600'}`}>
                    {SETOR_LABEL[envio.sector] ?? envio.sector}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal de categorização — setor já pré-selecionado */}
      {modalAberto && (
        <EnvioLoteModal
          arquivos={arquivosModal}
          setorInicial={setorSelecionado}
          onFechar={fecharModal}
          onSucesso={aoEnviarComSucesso}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-start gap-3 rounded-xl shadow-lg border p-4 pr-3
            ${toast.tipo === 'sucesso' ? 'bg-white dark:bg-gray-900 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-gray-900 border-red-200 dark:border-red-800'}`}
          >
            {toast.tipo === 'sucesso'
              ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle  size={18} className="text-red-500 shrink-0 mt-0.5" />
            }
            <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">{toast.msg}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
