'use client';

import { useState, useCallback } from 'react';
import useSWR                    from 'swr';

import { useAuth }                            from './useAuth';
import type { DocumentoClienteDTO }           from '../../../app/api/v1/documentos/route';

// =============================================================================
// Re-exporta o DTO para que os componentes não importem da camada de API
// =============================================================================

export type { DocumentoClienteDTO };

// =============================================================================
// Tipos
// =============================================================================

export type SetorFiltro = 'FISCAL' | 'PESSOAL' | 'CONTABIL';
export type CategoriaFiltro = 'xml' | 'extratos' | 'despesas' | 'impostos' | 'folha' | 'diversos';

export interface PaginaDocumentos {
  items:           DocumentoClienteDTO[];
  total:           number;
  page:            number;
  perPage:         number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
}

export interface DownloadResponse {
  url:             string;
  expiresAt:       string;
  primeiraLeitura: boolean;
  nomeArquivo:     string;
}

export interface UseDocumentosClienteReturn {
  documentos:      DocumentoClienteDTO[];
  carregando:      boolean;
  erro:            Error | null;
  total:           number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
  page:            number;
  setor:           SetorFiltro | undefined;
  setSetor:        (s: SetorFiltro | undefined) => void;
  categoria:       CategoriaFiltro | undefined;
  setCategoria:    (c: CategoriaFiltro | undefined) => void;
  setPage:         (p: number) => void;
  termo:           string | undefined;
  setTermo:        (t: string | undefined) => void;
  baixarDocumento: (id: string) => Promise<void>;
  /** IDs dos documentos com download em andamento (spinner no botão). */
  baixandoIds:     Set<string>;
  revalidar:       () => void;
}

export interface UseDocumentosClienteOptions {
  origem?: 'UPLOAD_CLIENTE' | 'UPLOAD_CONTADOR';
  initialPerPage?: number;
}

// =============================================================================
// useDocumentosCliente
//
// Busca a lista paginada de documentos do cliente logado via SWR e expõe
// `baixarDocumento()`, que realiza o fluxo completo de rastreabilidade:
//
//   1. Optimistic UI: marca `readStatus = true` no cache local (instantâneo)
//   2. Chama GET /api/v1/documentos/:id/download
//      → O backend registra a leitura (audit log + evento WebSocket para o contador)
//      → Retorna a Presigned URL do MinIO (válida 5 min)
//      → Opcionalmente filtra por origem ou termo de busca
//   3. Abre a URL em nova aba (browser baixa direto do MinIO)
//   4. Em caso de falha: rollback via SWR revalidation
//
// OTIMIZAÇÕES SWR:
//   - `revalidateOnFocus: false` → documentos mudam raramente; não recarrega ao focar
//   - `dedupingInterval: 10000` → evita refetch duplicado em 10s
//   - Chave muda com setor/página/origem/termo → SWR mantém cache separado por filtro
// =============================================================================

export function useDocumentosCliente(options?: UseDocumentosClienteOptions): UseDocumentosClienteReturn {
  const { token, getToken } = useAuth();

  const [setor,     setSetorState]    = useState<SetorFiltro | undefined>(undefined);
  const [categoria, setCategoriaState] = useState<CategoriaFiltro | undefined>(undefined);
  const [page,      setPageState]      = useState(1);
  const [termo,     setTermoState]     = useState<string | undefined>(undefined);
  const [baixandoIds, setBaixandoIds] = useState<Set<string>>(new Set());

  const setTermo = useCallback((t: string | undefined) => {
    setTermoState(t);
    setPageState(1);
  }, []);

  // -------------------------------------------------------------------------
  // SWR key e fetcher
  //
  // A chave muda quando: token, setor, page, termo ou opções mudam → dispara novo fetch.
  // `null` quando não autenticado → SWR suspende (não faz request).
  // -------------------------------------------------------------------------

  const buildUrl = useCallback(() => {
    const perPageVal = options?.initialPerPage ?? 20;
    const params = new URLSearchParams({
      page:    String(page),
      perPage: String(perPageVal),
    });
    if (setor)     params.set('sector',    setor);
    if (categoria) params.set('categoria', categoria);
    if (termo)     params.set('termo',     termo);
    if (options?.origem) params.set('origem', options.origem);
    return `/api/v1/documentos?${params.toString()}`;
  }, [setor, categoria, page, termo, options?.origem, options?.initialPerPage]);

  const swrKey = token ? [buildUrl(), token] : null;

  const fetcher = useCallback(
    async ([url]: [string, string]) => {
      const t = await getToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? 'Falha ao carregar documentos.');
      }
      return res.json() as Promise<PaginaDocumentos>;
    },
    [getToken],
  );

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<PaginaDocumentos>(swrKey, fetcher, {
    revalidateOnFocus:  false,
    dedupingInterval:   10_000,
    // Polling leve (30s): caso o contador envie documentos enquanto o cliente
    // está na tela, a lista atualiza automaticamente sem WebSocket no portal
    refreshInterval:    30_000,
  });

  // -------------------------------------------------------------------------
  // setSetor — reseta a página ao mudar o filtro de setor
  // -------------------------------------------------------------------------

  const setSetor = useCallback((s: SetorFiltro | undefined) => {
    setSetorState(s);
    setPageState(1);
  }, []);

  const setCategoria = useCallback((c: CategoriaFiltro | undefined) => {
    setCategoriaState(c);
    setPageState(1);
  }, []);

  const setPage = useCallback((p: number) => {
    setPageState(p);
  }, []);

  // -------------------------------------------------------------------------
  // baixarDocumento
  //
  // OPTIMISTIC UI:
  //   Antes de qualquer requisição, marca o documento como `readStatus: true`
  //   no cache SWR. Isso remove o badge "Novo" instantaneamente ao clicar,
  //   tornando a UI responsiva sem aguardar a resposta do servidor.
  //
  //   Se a API falhar → SWR revalida e restaura o estado real do banco.
  // -------------------------------------------------------------------------

  const baixarDocumento = useCallback(async (id: string): Promise<void> => {
    // Otimismo: atualiza o cache localmente sem revalidar
    await mutate(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((d) =>
            d.id === id
              ? { ...d, readStatus: true, readAt: new Date().toISOString() }
              : d,
          ),
        };
      },
      { revalidate: false },
    );

    setBaixandoIds((prev) => new Set([...prev, id]));

    try {
      const t = await getToken();

      const res = await fetch(`/api/v1/documentos/${id}/download`, {
        headers: { Authorization: `Bearer ${t}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message ?? 'Falha ao gerar link de download.',
        );
      }

      const { url, nomeArquivo } = (await res.json()) as DownloadResponse;

      // Força download para disco (evita abrir inline no PDF.js do Firefox).
      // <a download> funciona para URLs same-origin — o MinIO é servido via Nginx
      // no mesmo domínio (fiscohub.azura.dev.br/documentos-contabeis/...).
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo || 'documento';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Revalida para sincronizar readAt real do banco (best-effort)
      void mutate();

    } catch (err) {
      // Rollback: revalida o cache para restaurar o estado real do banco
      void mutate();
      throw err; // propaga para o componente mostrar o erro
    } finally {
      setBaixandoIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [mutate, getToken]);

  const revalidar = useCallback(() => { void mutate(); }, [mutate]);

  return {
    documentos:      data?.items           ?? [],
    carregando:      isLoading,
    erro:            error instanceof Error ? error : null,
    total:           data?.total           ?? 0,
    totalPages:      data?.totalPages      ?? 1,
    hasPreviousPage: data?.hasPreviousPage ?? false,
    hasNextPage:     data?.hasNextPage     ?? false,
    page,
    setor,
    setSetor,
    categoria,
    setCategoria,
    setPage,
    termo,
    setTermo,
    baixarDocumento,
    baixandoIds,
    revalidar,
  };
}
