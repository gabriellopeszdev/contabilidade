'use client';

import { useReducer, useCallback } from 'react';

// =============================================================================
// Tipos — Anti-Corruption Layer
// O frontend define suas próprias interfaces espelhando o contrato da API,
// sem importar tipos do domínio (src/domain/ ou src/application/).
// =============================================================================

export type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL';

export interface EnvioParams {
  clienteId: string;
  sector:    SetorTipo;
  /** Mês de competência fiscal no formato YYYY-MM-DD */
  competencia?: string;
  /** UUID opcional para idempotência em retentativas */
  loteId?: string;
}

// Arquivo no estado local — discriminated union mapeada para feedback visual
export type EstadoArquivo =
  | { fase: 'aguardando'; file: File }
  | { fase: 'invalido';   file: File; motivo: string }
  | { fase: 'enviando';   file: File }
  | { fase: 'sucesso';    file: File; documentoId: string }
  | { fase: 'falhou';     file: File; motivo: string };

export type FaseUpload = 'idle' | 'enviando' | 'concluido';

export interface ResultadoLote {
  loteId:          string;
  totalArquivos:   number;
  totalUploadados: number;
  totalFalhas:     number;
}

// Resposta da API — espelha o shape do route.ts
interface RespostaApi {
  ok:              boolean;
  loteId:          string;
  totalArquivos:   number;
  totalUploadados: number;
  totalFalhas:     number;
  uploadados: Array<{ documentoId: string; fileName: string; fileHash: string }>;
  falhas:     Array<{ fileName: string; motivo: string }>;
}

// =============================================================================
// Estado e Reducer
// =============================================================================

interface Estado {
  fase:       FaseUpload;
  arquivos:   EstadoArquivo[];
  progresso:  number; // 0–100
  resultado:  ResultadoLote | null;
  erroGlobal: string | null;
}

type Acao =
  | { tipo: 'ADICIONAR';           novos: EstadoArquivo[] }
  | { tipo: 'REMOVER';             indice: number }
  | { tipo: 'INICIAR_ENVIO' }
  | { tipo: 'PROGRESSO';           valor: number }
  | { tipo: 'CONCLUIR';            resultado: ResultadoLote; arquivosAtualizados: EstadoArquivo[] }
  | { tipo: 'ERRO_GLOBAL';         mensagem: string }
  | { tipo: 'REINICIAR' };

const estadoInicial: Estado = {
  fase:       'idle',
  arquivos:   [],
  progresso:  0,
  resultado:  null,
  erroGlobal: null,
};

function reducer(estado: Estado, acao: Acao): Estado {
  switch (acao.tipo) {

    case 'ADICIONAR':
      return {
        ...estado,
        // Filtra duplicatas pelo nome do arquivo (defesa contra duplo clique)
        arquivos: [
          ...estado.arquivos,
          ...acao.novos.filter(
            (novo) => !estado.arquivos.some((ex) => ex.file.name === novo.file.name),
          ),
        ],
      };

    case 'REMOVER': {
      const arr = [...estado.arquivos];
      arr.splice(acao.indice, 1);
      return { ...estado, arquivos: arr };
    }

    case 'INICIAR_ENVIO':
      return {
        ...estado,
        fase:       'enviando',
        progresso:  0,
        erroGlobal: null,
        // Marca todos os válidos como 'enviando'
        arquivos: estado.arquivos.map((a) =>
          a.fase === 'aguardando' ? { ...a, fase: 'enviando' as const } : a,
        ),
      };

    case 'PROGRESSO':
      return { ...estado, progresso: acao.valor };

    case 'CONCLUIR':
      return {
        ...estado,
        fase:      'concluido',
        progresso: 100,
        resultado: acao.resultado,
        arquivos:  acao.arquivosAtualizados,
      };

    case 'ERRO_GLOBAL':
      return {
        ...estado,
        fase:      'concluido',
        erroGlobal: acao.mensagem,
        // Reverte arquivos 'enviando' para 'aguardando' (podem tentar novamente)
        arquivos: estado.arquivos.map((a) =>
          a.fase === 'enviando' ? { ...a, fase: 'aguardando' as const } : a,
        ),
      };

    case 'REINICIAR':
      return estadoInicial;

    default:
      return estado;
  }
}

// =============================================================================
// Validação client-side (espelha UploadLoteSchema.ts — defense in depth)
// Executada ANTES de qualquer requisição para poupar banda.
// =============================================================================

const MAX_TAMANHO = 10 * 1_048_576; // 10 MB
const EXTENSOES   = new Set(['.xml', '.pdf']);
const MIMES       = new Set(['application/xml', 'text/xml', 'application/pdf']);
const MAX_ARQUIVOS = 50;

function validarArquivoLocal(file: File): string | null {
  if (file.size === 0) return 'Arquivo vazio (0 bytes)';
  if (file.size > MAX_TAMANHO)
    return `${(file.size / 1_048_576).toFixed(1)} MB excede o limite de 10 MB`;

  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
  if (!EXTENSOES.has(ext))
    return `Extensão "${ext}" não permitida. Aceitos: .xml, .pdf`;

  if (!MIMES.has(file.type))
    return `Tipo "${file.type || 'desconhecido'}" não permitido`;

  return null;
}

// =============================================================================
// Upload com progresso real via XMLHttpRequest
// fetch() não expõe progresso de upload — XHR é a única forma nativa.
// =============================================================================

function uploadComProgresso(
  formData: FormData,
  token: string,
  onProgresso: (pct: number) => void,
): Promise<{ status: number; data: RespostaApi }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgresso(Math.round((e.loaded / e.total) * 95)); // reserva 5% para parse
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as RespostaApi;
        resolve({ status: xhr.status, data });
      } catch {
        reject(new Error('Resposta do servidor inválida (JSON malformado).'));
      }
    };

    xhr.onerror   = () => reject(new Error('Erro de rede. Verifique sua conexão.'));
    xhr.ontimeout = () => reject(new Error('Tempo limite excedido (2 minutos).'));

    xhr.open('POST', '/api/v1/documentos/lote');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 120_000; // 2 min para lotes grandes

    xhr.send(formData);
  });
}

// =============================================================================
// Hook principal: useUploadLote
// =============================================================================

export interface UseUploadLoteReturn {
  fase:       FaseUpload;
  arquivos:   EstadoArquivo[];
  progresso:  number;
  resultado:  ResultadoLote | null;
  erroGlobal: string | null;
  /** Arquivos prontos para envio (válidos, sem duplicata) */
  totalValidos:   number;
  totalInvalidos: number;
  podeEnviar:     boolean;

  adicionarArquivos: (files: File[]) => void;
  removerArquivo:    (indice: number) => void;
  /** Envia o lote para a API. Lança exceção em erro de rede. */
  enviar:    (params: EnvioParams) => Promise<void>;
  reiniciar: () => void;
}

export function useUploadLote(
  getToken: () => Promise<string>,
): UseUploadLoteReturn {
  const [estado, despachar] = useReducer(reducer, estadoInicial);

  // -------------------------------------------------------------------------
  // adicionarArquivos — valida client-side e atualiza a lista
  // -------------------------------------------------------------------------
  const adicionarArquivos = useCallback((files: File[]) => {
    const novos: EstadoArquivo[] = files.map((file) => {
      const motivo = validarArquivoLocal(file);
      return motivo
        ? { fase: 'invalido' as const, file, motivo }
        : { fase: 'aguardando' as const, file };
    });
    despachar({ tipo: 'ADICIONAR', novos });
  }, []);

  const removerArquivo = useCallback(
    (indice: number) => despachar({ tipo: 'REMOVER', indice }),
    [],
  );

  const reiniciar = useCallback(() => despachar({ tipo: 'REINICIAR' }), []);

  // -------------------------------------------------------------------------
  // enviar — orquestra validação, XHR, e interpretação da resposta
  // -------------------------------------------------------------------------
  const enviar = useCallback(
    async (params: EnvioParams) => {
      const validos = estado.arquivos.filter((a) => a.fase === 'aguardando');

      if (validos.length === 0) return;
      if (validos.length > MAX_ARQUIVOS) {
        despachar({
          tipo: 'ERRO_GLOBAL',
          mensagem: `Máximo de ${MAX_ARQUIVOS} arquivos por lote.`,
        });
        return;
      }

      despachar({ tipo: 'INICIAR_ENVIO' });

      let token: string;
      try {
        token = await getToken();
      } catch {
        despachar({ tipo: 'ERRO_GLOBAL', mensagem: 'Sessão expirada. Faça login novamente.' });
        return;
      }

      // Monta o FormData com os arquivos e metadados
      const form = new FormData();
      form.set('clienteId', params.clienteId);
      form.set('sector',    params.sector);
      if (params.competencia) form.set('competencia', params.competencia);
      if (params.loteId)      form.set('loteId',      params.loteId);
      validos.forEach((a) => form.append('arquivos', a.file));

      let resposta: { status: number; data: RespostaApi };
      try {
        resposta = await uploadComProgresso(form, token, (pct) =>
          despachar({ tipo: 'PROGRESSO', valor: pct }),
        );
      } catch (err) {
        despachar({
          tipo: 'ERRO_GLOBAL',
          mensagem: err instanceof Error ? err.message : 'Erro inesperado.',
        });
        return;
      }

      const { status, data } = resposta;

      // Erros HTTP que não retornam payload de upload (auth, validação, servidor)
      if (status === 400 || status === 401 || status === 403 || status >= 500) {
        despachar({
          tipo: 'ERRO_GLOBAL',
          mensagem: (data as { error?: string }).error ?? `Erro HTTP ${status}`,
        });
        return;
      }

      // 201 / 207 / 422 — atualiza estado individual de cada arquivo
      type ResultadoArquivo =
        | { ok: true;  documentoId: string }
        | { ok: false; motivo: string };

      const mapaResultados = new Map<string, ResultadoArquivo>([
        ...data.uploadados.map((u): [string, ResultadoArquivo] => [
          u.fileName, { ok: true, documentoId: u.documentoId },
        ]),
        ...data.falhas.map((f): [string, ResultadoArquivo] => [
          f.fileName, { ok: false, motivo: f.motivo },
        ]),
      ]);

      const arquivosAtualizados: EstadoArquivo[] = estado.arquivos.map((a) => {
        if (a.fase !== 'aguardando' && a.fase !== 'enviando') return a;
        const res = mapaResultados.get(a.file.name);
        if (!res)       return { ...a, fase: 'aguardando' as const }; // não estava no lote
        if (res.ok)     return { fase: 'sucesso' as const, file: a.file, documentoId: res.documentoId };
        return           { fase: 'falhou'  as const, file: a.file, motivo: res.motivo };
      });

      despachar({
        tipo: 'CONCLUIR',
        resultado: {
          loteId:          data.loteId,
          totalArquivos:   data.totalArquivos,
          totalUploadados: data.totalUploadados,
          totalFalhas:     data.totalFalhas,
        },
        arquivosAtualizados,
      });
    },
    [estado.arquivos, getToken],
  );

  const totalValidos   = estado.arquivos.filter((a) => a.fase === 'aguardando').length;
  const totalInvalidos = estado.arquivos.filter((a) => a.fase === 'invalido').length;

  return {
    fase:       estado.fase,
    arquivos:   estado.arquivos,
    progresso:  estado.progresso,
    resultado:  estado.resultado,
    erroGlobal: estado.erroGlobal,
    totalValidos,
    totalInvalidos,
    podeEnviar: estado.fase === 'idle' && totalValidos > 0,
    adicionarArquivos,
    removerArquivo,
    enviar,
    reiniciar,
  };
}
