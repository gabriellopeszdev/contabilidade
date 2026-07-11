'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// Tipos
// =============================================================================

type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL';

interface UploadClienteModalProps {
  aberto:    boolean;
  onFechar:  () => void;
  onSucesso: () => void;
}

const SETORES: { value: SetorTipo; label: string; desc: string }[] = [
  { value: 'FISCAL',   label: 'Fiscal',   desc: 'Notas fiscais, DANFE, guias de imposto' },
  { value: 'PESSOAL',  label: 'Pessoal',  desc: 'Documentos pessoais, RG, CPF, comprovantes' },
  { value: 'CONTABIL', label: 'Contábil', desc: 'Balanços, DRE, extratos bancários' },
];

const TIPOS_ACEITOS = '.pdf,.xml,.zip,.rar,application/pdf,application/xml,text/xml,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/vnd.rar';
const MAX_SIZE_MB   = 500;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// =============================================================================
// UploadClienteModal
//
// Modal de envio de documentos do cliente para o contador.
// Suporta drag-and-drop + seleção por clique. Valida tipo (PDF/XML) e tamanho.
// =============================================================================

export function UploadClienteModal({ aberto, onFechar, onSucesso }: UploadClienteModalProps) {
  const { token } = useAuth();

  const [arquivo, setArquivo]     = useState<File | null>(null);
  const [setor, setSetor]         = useState<SetorTipo>('FISCAL');
  const [enviando, setEnviando]   = useState(false);
  const [resultado, setResultado] = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);
  const [dragAtivo, setDragAtivo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Reset ao fechar
  // ---------------------------------------------------------------------------
  const handleFechar = useCallback(() => {
    if (enviando) return;
    setArquivo(null);
    setSetor('FISCAL');
    setResultado(null);
    setDragAtivo(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onFechar();
  }, [enviando, onFechar]);

  // ---------------------------------------------------------------------------
  // Validação de arquivo
  // ---------------------------------------------------------------------------
  const validarArquivo = useCallback((file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'xml', 'zip', 'rar'].includes(ext ?? '')) {
      return 'Formato não suportado. Envie PDF, XML, ZIP ou RAR.';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `Arquivo muito grande. O tamanho máximo é ${MAX_SIZE_MB} MB.`;
    }
    return null;
  }, []);

  const selecionarArquivo = useCallback((file: File) => {
    const erro = validarArquivo(file);
    if (erro) {
      setResultado({ tipo: 'erro', msg: erro });
      return;
    }
    setResultado(null);
    setArquivo(file);
  }, [validarArquivo]);

  // ---------------------------------------------------------------------------
  // Drag and drop
  // ---------------------------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragAtivo(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragAtivo(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragAtivo(false);

    const file = e.dataTransfer.files[0];
    if (file) selecionarArquivo(file);
  }, [selecionarArquivo]);

  // ---------------------------------------------------------------------------
  // Envio
  // ---------------------------------------------------------------------------
  const handleEnviar = useCallback(async () => {
    if (!arquivo || !token) return;

    setEnviando(true);
    setResultado(null);

    try {
      const form = new FormData();
      form.append('arquivo', arquivo);
      form.append('setor', setor);

      const res = await fetch('/api/v1/documentos/cliente-upload', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });

      const body = await res.json().catch(() => ({})) as { message?: string };

      if (!res.ok) {
        throw new Error(body.message ?? `Erro HTTP ${res.status}`);
      }

      setResultado({ tipo: 'sucesso', msg: 'Documento enviado com sucesso! Seu contador já foi notificado.' });
      setArquivo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Notifica o pai para revalidar dados
      onSucesso();
    } catch (err) {
      setResultado({
        tipo: 'erro',
        msg: err instanceof Error ? err.message : 'Erro ao enviar documento.',
      });
    } finally {
      setEnviando(false);
    }
  }, [arquivo, setor, token, onSucesso]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleFechar} />

      {/* Conteúdo */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20">
              <Upload size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Enviar Documento</h3>
              <p className="text-xs text-gray-500">Selecione o arquivo e o setor de destino</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFechar}
            disabled={enviando}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                       transition-colors disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Seletor de setor */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Setor</label>
          <div className="grid grid-cols-3 gap-2">
            {SETORES.map((s) => (
              <button
                key={s.value}
                type="button"
                disabled={enviando}
                onClick={() => setSetor(s.value)}
                className={`rounded-lg border px-3 py-2.5 text-center transition-all disabled:opacity-50
                  ${setor === s.value
                    ? 'border-primary bg-primary/10 dark:bg-primary/20 ring-2 ring-primary/30'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                <p className={`text-sm font-semibold ${setor === s.value ? 'text-primary-dark' : 'text-gray-900'}`}>
                  {s.label}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Zona de drop / seleção de arquivo */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !enviando && fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer
                      transition-all
                      ${dragAtivo
                        ? 'border-primary bg-primary/10 dark:bg-primary/20'
                        : arquivo
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : 'border-gray-300 bg-gray-50 hover:border-primary hover:bg-primary-50/30'
                      }
                      ${enviando ? 'pointer-events-none opacity-50' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={TIPOS_ACEITOS}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) selecionarArquivo(file);
            }}
            disabled={enviando}
            className="hidden"
          />

          {arquivo ? (
            <div className="flex flex-col items-center gap-2">
              <FileText size={32} className="text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-gray-900 truncate max-w-[300px]">
                  {arquivo.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(arquivo.size / 1024).toFixed(0)} KB &middot; {arquivo.name.split('.').pop()?.toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setArquivo(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs text-gray-500 hover:text-red-500 underline mt-1"
              >
                Remover arquivo
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <CloudUpload size={32} className="text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Arraste um arquivo aqui ou <span className="text-primary underline">clique para selecionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  PDF, XML, ZIP ou RAR &middot; Máximo {MAX_SIZE_MB} MB
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Resultado / feedback */}
        {resultado && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm
            ${resultado.tipo === 'sucesso'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {resultado.tipo === 'sucesso'
              ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle  size={16} className="text-red-500 shrink-0 mt-0.5" />
            }
            <span className="text-xs">{resultado.msg}</span>
          </div>
        )}

        {/* Botão enviar */}
        <button
          type="button"
          onClick={handleEnviar}
          disabled={!arquivo || enviando}
          className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-primary
                     rounded-xl hover:bg-primary-dark transition-colors shadow-sm
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                     flex items-center justify-center gap-2"
        >
          {enviando ? (
            <><Loader2 size={16} className="animate-spin" /> Enviando…</>
          ) : (
            <><Upload size={16} /> Enviar Documento</>
          )}
        </button>
      </div>
    </div>
  );
}
