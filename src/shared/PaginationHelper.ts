import { DomainException } from '../domain/exceptions/DomainException';

// ---------------------------------------------------------------------------
// Tipos compartilhados de paginação
// ---------------------------------------------------------------------------

export interface PaginacaoParams {
  /** Número da página (base 1). */
  page: number;
  /** Quantidade de itens por página (máx: 100). */
  perPage: number;
}

export interface ResultadoPaginado<T> {
  items: T[];
  /** Total de registros que satisfazem os filtros (sem paginação). */
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  /** Indica se existe uma página anterior. */
  hasPreviousPage: boolean;
  /** Indica se existe uma próxima página. */
  hasNextPage: boolean;
}

// ---------------------------------------------------------------------------
// Helper estático
// ---------------------------------------------------------------------------

export const PaginacaoHelper = {
  MAX_PER_PAGE: 100,
  DEFAULT_PER_PAGE: 20,
  MIN_PAGE: 1,

  /** Valida os parâmetros de paginação, lançando DomainException se inválidos. */
  validar(params: PaginacaoParams): void {
    if (!Number.isInteger(params.page) || params.page < PaginacaoHelper.MIN_PAGE) {
      throw new DomainException(
        `Página inválida: ${params.page}. Deve ser um inteiro >= 1.`,
      );
    }
    if (
      !Number.isInteger(params.perPage) ||
      params.perPage < 1 ||
      params.perPage > PaginacaoHelper.MAX_PER_PAGE
    ) {
      throw new DomainException(
        `perPage inválido: ${params.perPage}. Deve ser um inteiro entre 1 e ${PaginacaoHelper.MAX_PER_PAGE}.`,
      );
    }
  },

  /** Calcula o offset SQL a partir da paginação. */
  calcularOffset(params: PaginacaoParams): number {
    return (params.page - 1) * params.perPage;
  },

  /** Constrói o objeto ResultadoPaginado a partir dos dados do repositório. */
  construir<T>(
    items: T[],
    total: number,
    params: PaginacaoParams,
  ): ResultadoPaginado<T> {
    const totalPages = Math.max(1, Math.ceil(total / params.perPage));
    return {
      items,
      total,
      page: params.page,
      perPage: params.perPage,
      totalPages,
      hasPreviousPage: params.page > 1,
      hasNextPage: params.page < totalPages,
    };
  },

  /** Retorna parâmetros padrão de paginação. */
  padrao(): PaginacaoParams {
    return { page: 1, perPage: PaginacaoHelper.DEFAULT_PER_PAGE };
  },
};
