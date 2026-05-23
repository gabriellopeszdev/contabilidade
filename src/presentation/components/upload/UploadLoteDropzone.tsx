'use client';

import { useRef, useState, useCallback, useId } from 'react';
import {
  UploadCloud,
  FileCode,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  AlertTriangle,
  FileQuestion,
} from 'lucide-react';

import {
  useUploadLote,
  type SetorTipo,
  type EstadoArquivo,
  type ResultadoLote,
} from '../../hooks/useUploadLote';

// =============================================================================
// Props
// =============================================================================

export interface UploadLoteDropzoneProps {
  /** ID do cliente cujos documentos serão enviados. null = nenhum selecionado. */
  clienteId: string | null;
  /** Nome do cliente selecionado (exibido no feedback de sucesso). */
  clienteNome?: string;
  /** Função que retorna o JWT atual (pode renovar token se expirado). */
  getToken: () => Promise<string>;
  /** Callback chamado após conclusão do upload (sucesso ou parcial). */
  onUploadConcluido?: (resultado: ResultadoLote) => void;
  /** Setores permitidos para o usuário. Se omitido, mostra todos. */
  setoresPermitidos?: string[];
}

// =============================================================================
// Helpers visuais
// =============================================================================

const SETORES: { valor: SetorTipo; label: string; cor: string }[] = [
  { valor: 'FISCAL',   label: 'Fiscal',            cor: 'blue'   },
  { valor: 'PESSOAL',  label: 'Departamento Pessoal', cor: 'violet' },
  { valor: 'CONTABIL', label: 'Contábil',           cor: 'emerald' },
];

const COR_SETOR: Record<SetorTipo, string> = {
  FISCAL:   'bg-primary     text-white ring-primary',
  PESSOAL:  'bg-primary     text-white ring-primary',
  CONTABIL: 'bg-emerald-600 text-white ring-emerald-300',
};

const COR_SETOR_INATIVO: Record<SetorTipo, string> = {
  FISCAL:   'hover:bg-primary-50 text-primary-dark border-primary',
  PESSOAL:  'hover:bg-primary-50 text-primary-dark border-primary',
  CONTABIL: 'hover:bg-emerald-50 text-emerald-700 border-emerald-200',
};

function iconeArquivo(nome: string): React.ReactNode {
  const ext = nome.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText  size={18} className="text-red-500   shrink-0" />;
  if (ext === 'xml') return <FileCode  size={18} className="text-blue-500  shrink-0" />;
  return                    <FileQuestion size={18} className="text-gray-400 shrink-0" />;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1_048_576)      return `${(bytes / 1024).toFixed(1)} KB`;
  return                             `${(bytes / 1_048_576).toFixed(2)} MB`;
}

// =============================================================================
// Sub-componente: item de arquivo na lista
// =============================================================================

interface ItemArquivoProps {
  arquivo:  EstadoArquivo;
  indice:   number;
  onRemover: (i: number) => void;
  desabilitado: boolean;
}

function ItemArquivo({ arquivo, indice, onRemover, desabilitado }: ItemArquivoProps) {
  const { fase, file } = arquivo;

  const configFase = {
    aguardando: {
      bg:    'bg-white border-gray-200',
      icone: <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />,
      extra: null,
    },
    invalido: {
      bg:    'bg-amber-50 border-amber-200',
      icone: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
      extra: (
        <p className="text-xs text-amber-700 mt-1 ml-7 font-medium">
          {(arquivo as Extract<EstadoArquivo, { fase: 'invalido' }>).motivo}
        </p>
      ),
    },
    enviando: {
      bg:    'bg-blue-50 border-blue-200',
      icone: <Loader2 size={18} className="text-blue-500 shrink-0 animate-spin" />,
      extra: null,
    },
    sucesso: {
      bg:    'bg-green-50 border-green-200',
      icone: <CheckCircle2 size={18} className="text-green-500 shrink-0" />,
      extra: null,
    },
    falhou: {
      bg:    'bg-red-50 border-red-200',
      icone: <XCircle size={18} className="text-red-500 shrink-0" />,
      extra: (
        <p className="text-xs text-red-700 mt-1 ml-7 font-medium">
          {(arquivo as Extract<EstadoArquivo, { fase: 'falhou' }>).motivo}
        </p>
      ),
    },
  }[fase];

  return (
    <li className={`rounded-lg border px-3 py-2.5 transition-colors ${configFase.bg}`}>
      <div className="flex items-center gap-2 min-w-0">
        {configFase.icone}
        {iconeArquivo(file.name)}
        <span
          className="flex-1 text-sm font-medium text-gray-800 truncate"
          title={file.name}
        >
          {file.name}
        </span>
        <span className="text-xs text-gray-500 shrink-0">
          {formatarTamanho(file.size)}
        </span>
        {(fase === 'aguardando' || fase === 'invalido') && !desabilitado && (
          <button
            type="button"
            onClick={() => onRemover(indice)}
            aria-label={`Remover ${file.name}`}
            className="ml-1 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50
                       transition-colors focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-red-400"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {configFase.extra}
    </li>
  );
}

// =============================================================================
// Componente principal: UploadLoteDropzone
// =============================================================================

export function UploadLoteDropzone({
  clienteId,
  clienteNome,
  getToken,
  onUploadConcluido,
  setoresPermitidos,
}: UploadLoteDropzoneProps) {

  // Filtra setores disponíveis conforme permissões do usuário
  const temTodos = setoresPermitidos?.includes('TODOS');
  const setoresVisiveis = (!setoresPermitidos || setoresPermitidos.length === 0 || temTodos)
    ? SETORES
    : SETORES.filter((s) => setoresPermitidos.includes(s.valor));

  const {
    fase,
    arquivos,
    progresso,
    resultado,
    erroGlobal,
    totalValidos,
    totalInvalidos,
    podeEnviar,
    adicionarArquivos,
    removerArquivo,
    enviar,
    reiniciar,
  } = useUploadLote(getToken);

  // Formulário de metadados
  const [sector,      setSector]      = useState<SetorTipo>(setoresVisiveis[0]?.valor ?? 'FISCAL');
  const [competencia, setCompetencia] = useState('');

  // Drag state — counter evita glitch ao mover sobre elementos filhos
  const [isDragOver, setIsDragOver]   = useState(false);
  const dragCounter                   = useRef(0);

  const inputRef  = useRef<HTMLInputElement>(null);
  const inputId   = useId();

  // -------------------------------------------------------------------------
  // Drag & Drop handlers
  // -------------------------------------------------------------------------

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // necessário para habilitar o evento drop
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) adicionarArquivos(dropped);
  }, [adicionarArquivos]);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length > 0) adicionarArquivos(selected);
      // Reset para permitir selecionar o mesmo arquivo novamente
      e.target.value = '';
    },
    [adicionarArquivos],
  );

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  // UUID v4 regex — mesma usada no backend (defense in depth)
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Erro local exibido acima do botão quando faltam pré-condições
  const [erroLocal, setErroLocal] = useState('');

  const handleEnviar = useCallback(async () => {
    setErroLocal('');

    if (!clienteId) {
      setErroLocal('Selecione um cliente antes de enviar.');
      return;
    }

    if (!UUID_V4.test(clienteId)) {
      setErroLocal(`ID do cliente inválido (${clienteId}). Selecione novamente.`);
      return;
    }

    if (totalValidos === 0) {
      setErroLocal('Adicione pelo menos um arquivo válido.');
      return;
    }

    // Converte competência YYYY-MM → YYYY-MM-01 para o backend (Zod espera YYYY-MM-DD)
    const compFormatada = competencia ? `${competencia}-01` : undefined;
    await enviar({ clienteId, sector, competencia: compFormatada });
    if (resultado) onUploadConcluido?.(resultado);
  }, [enviar, clienteId, sector, competencia, resultado, onUploadConcluido, totalValidos]);

  // Dispara callback quando resultado fica disponível
  const handleReiniciar = useCallback(() => {
    reiniciar();
    setSector(setoresVisiveis[0]?.valor ?? 'FISCAL');
    setCompetencia('');
  }, [reiniciar, setoresVisiveis]);

  const enviando    = fase === 'enviando';
  const concluido   = fase === 'concluido';
  const temArquivos = arquivos.length > 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5">

      {/* ------------------------------------------------------------------ */}
      {/* Seletor de Setor                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Setor fiscal">
        {setoresVisiveis.map(({ valor, label }) => {
          const ativo = sector === valor;
          return (
            <button
              key={valor}
              type="button"
              disabled={enviando || concluido}
              onClick={() => setSector(valor)}
              aria-pressed={ativo}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                          disabled:opacity-50 disabled:cursor-not-allowed
                          ${ativo
                            ? `${COR_SETOR[valor]} shadow-sm ring-2`
                            : `bg-white ${COR_SETOR_INATIVO[valor]}`
                          }`}
            >
              {label}
            </button>
          );
        })}

        {/* Competência */}
        <div className="ml-auto flex items-center gap-2">
          <label
            htmlFor={inputId + '-comp'}
            className="text-sm text-gray-600 font-medium"
          >
            Competência:
          </label>
          <input
            id={inputId + '-comp'}
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            disabled={enviando || concluido}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:opacity-50 disabled:bg-gray-100"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Zona de Drop                                                        */}
      {/* ------------------------------------------------------------------ */}
      {!concluido && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Zona de upload: clique ou arraste arquivos XML ou PDF"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !enviando && inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !enviando && inputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all
                      flex flex-col items-center justify-center gap-3 py-12 px-6 text-center
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                      ${enviando
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed pointer-events-none'
                        : isDragOver
                          ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                          : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                      }`}
        >
          <UploadCloud
            size={44}
            className={`transition-colors ${
              isDragOver ? 'text-blue-500' : 'text-gray-400'
            }`}
          />
          <div>
            <p className={`text-base font-semibold transition-colors ${
              isDragOver ? 'text-blue-700' : 'text-gray-700'
            }`}>
              {isDragOver
                ? 'Solte os arquivos aqui'
                : 'Arraste arquivos XML ou PDF aqui'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              ou{' '}
              <span className="text-blue-600 font-medium underline underline-offset-2">
                clique para selecionar
              </span>
              {' '}— máx. 10 MB por arquivo, até 50 arquivos
            </p>
          </div>

          {/* Input oculto */}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept=".xml,.pdf,application/xml,text/xml,application/pdf"
            onChange={handleFileInput}
            className="sr-only"
            aria-hidden="true"
          />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Lista de Arquivos                                                   */}
      {/* ------------------------------------------------------------------ */}
      {temArquivos && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">
              {arquivos.length} arquivo{arquivos.length !== 1 ? 's' : ''} selecionado{arquivos.length !== 1 ? 's' : ''}
              {totalInvalidos > 0 && (
                <span className="ml-2 text-amber-600">
                  ({totalInvalidos} com erro{totalInvalidos !== 1 ? 's' : ''})
                </span>
              )}
            </p>
            {!enviando && !concluido && (
              <button
                type="button"
                onClick={() => reiniciar()}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Limpar tudo
              </button>
            )}
          </div>

          <ul className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
            {arquivos.map((arquivo, i) => (
              <ItemArquivo
                key={arquivo.file.name + i}
                arquivo={arquivo}
                indice={i}
                onRemover={removerArquivo}
                desabilitado={enviando || concluido}
              />
            ))}
          </ul>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Barra de Progresso (visível durante o envio)                        */}
      {/* ------------------------------------------------------------------ */}
      {enviando && (
        <div aria-live="polite" role="status" aria-label={`Upload em progresso: ${progresso}%`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Enviando {totalValidos} arquivo{totalValidos !== 1 ? 's' : ''}…
            </span>
            <span className="text-sm font-semibold text-blue-700">{progresso}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-200 ease-out"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Resumo pós-upload                                                   */}
      {/* ------------------------------------------------------------------ */}
      {concluido && resultado && (
        <div
          className={`rounded-xl border p-4 ${
            resultado.totalFalhas === 0
              ? 'bg-green-50 border-green-200'
              : resultado.totalUploadados === 0
                ? 'bg-red-50 border-red-200'
                : 'bg-amber-50 border-amber-200'
          }`}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-3">
            {resultado.totalFalhas === 0 ? (
              <CheckCircle2 size={22} className="text-green-600 shrink-0" />
            ) : resultado.totalUploadados === 0 ? (
              <XCircle      size={22} className="text-red-600   shrink-0" />
            ) : (
              <AlertTriangle size={22} className="text-amber-600 shrink-0" />
            )}
            <div>
              <p className={`font-semibold text-sm ${
                resultado.totalFalhas === 0
                  ? 'text-green-800'
                  : resultado.totalUploadados === 0
                    ? 'text-red-800'
                    : 'text-amber-800'
              }`}>
                {resultado.totalFalhas === 0
                  ? `${resultado.totalUploadados} documento${resultado.totalUploadados !== 1 ? 's' : ''} enviado${resultado.totalUploadados !== 1 ? 's' : ''} com sucesso${clienteNome ? ` para ${clienteNome}` : ''}`
                  : resultado.totalUploadados === 0
                    ? 'Nenhum documento foi enviado'
                    : `${resultado.totalUploadados} de ${resultado.totalArquivos} enviados${clienteNome ? ` para ${clienteNome}` : ''} — ${resultado.totalFalhas} falha${resultado.totalFalhas !== 1 ? 's' : ''}`
                }
              </p>
              <p className="text-xs mt-0.5 text-gray-500">
                ID do lote: <code className="font-mono">{resultado.loteId}</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Erro global (rede, auth) */}
      {erroGlobal && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3"
          role="alert"
          aria-live="assertive"
        >
          <XCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-red-700">{erroGlobal}</p>
        </div>
      )}

      {/* Erro local (pré-condições) */}
      {erroLocal && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-amber-700">{erroLocal}</p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Ações principais                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {concluido ? (
          <button
            type="button"
            onClick={handleReiniciar}
            className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold
                       hover:bg-gray-200 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            Novo Upload
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEnviar}
            disabled={enviando}
            aria-busy={enviando}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                        text-white transition-all shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${(!podeEnviar || !clienteId) ? 'opacity-60' : ''}
                        ${sector === 'CONTABIL'
                          ? 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500'
                          : 'bg-primary hover:brightness-90 focus-visible:ring-primary'
                        }`}
          >
            {enviando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <UploadCloud size={16} />
                Enviar {totalValidos > 0 ? `(${totalValidos})` : ''}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
