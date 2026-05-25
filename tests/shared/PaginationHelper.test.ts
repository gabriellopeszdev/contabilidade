import { describe, it, expect } from 'vitest';
import { PaginacaoHelper } from '../../src/shared/PaginationHelper';
import { DomainException } from '../../src/domain/exceptions/DomainException';

describe('PaginacaoHelper', () => {
  describe('validar()', () => {
    it('não lança para parâmetros válidos', () => {
      expect(() => PaginacaoHelper.validar({ page: 1, perPage: 20 })).not.toThrow();
      expect(() => PaginacaoHelper.validar({ page: 5, perPage: 100 })).not.toThrow();
    });

    it('lança DomainException para page < 1', () => {
      expect(() => PaginacaoHelper.validar({ page: 0, perPage: 20 })).toThrow(DomainException);
    });

    it('lança DomainException para page negativa', () => {
      expect(() => PaginacaoHelper.validar({ page: -1, perPage: 20 })).toThrow(DomainException);
    });

    it('lança DomainException para page não inteira', () => {
      expect(() => PaginacaoHelper.validar({ page: 1.5, perPage: 20 })).toThrow(DomainException);
    });

    it('lança DomainException para perPage = 0', () => {
      expect(() => PaginacaoHelper.validar({ page: 1, perPage: 0 })).toThrow(DomainException);
    });

    it('lança DomainException para perPage > 100', () => {
      expect(() => PaginacaoHelper.validar({ page: 1, perPage: 101 })).toThrow(DomainException);
    });

    it('aceita perPage = 100 (limite máximo)', () => {
      expect(() => PaginacaoHelper.validar({ page: 1, perPage: 100 })).not.toThrow();
    });

    it('aceita page = 1 (mínimo)', () => {
      expect(() => PaginacaoHelper.validar({ page: 1, perPage: 1 })).not.toThrow();
    });
  });

  describe('calcularOffset()', () => {
    it('página 1 → offset 0', () => {
      expect(PaginacaoHelper.calcularOffset({ page: 1, perPage: 20 })).toBe(0);
    });

    it('página 2 com perPage=20 → offset 20', () => {
      expect(PaginacaoHelper.calcularOffset({ page: 2, perPage: 20 })).toBe(20);
    });

    it('página 3 com perPage=10 → offset 20', () => {
      expect(PaginacaoHelper.calcularOffset({ page: 3, perPage: 10 })).toBe(20);
    });

    it('página 5 com perPage=15 → offset 60', () => {
      expect(PaginacaoHelper.calcularOffset({ page: 5, perPage: 15 })).toBe(60);
    });
  });

  describe('construir()', () => {
    const params = { page: 1, perPage: 10 };

    it('inclui os itens e total corretos', () => {
      const r = PaginacaoHelper.construir(['a', 'b'], 2, params);
      expect(r.items).toEqual(['a', 'b']);
      expect(r.total).toBe(2);
    });

    it('calcula totalPages corretamente', () => {
      expect(PaginacaoHelper.construir([], 25, { page: 1, perPage: 10 }).totalPages).toBe(3);
      expect(PaginacaoHelper.construir([], 20, { page: 1, perPage: 10 }).totalPages).toBe(2);
      expect(PaginacaoHelper.construir([], 1,  { page: 1, perPage: 10 }).totalPages).toBe(1);
    });

    it('totalPages mínimo é 1 mesmo com total=0', () => {
      expect(PaginacaoHelper.construir([], 0, params).totalPages).toBe(1);
    });

    it('hasPreviousPage é false na primeira página', () => {
      expect(PaginacaoHelper.construir([], 50, { page: 1, perPage: 10 }).hasPreviousPage).toBe(false);
    });

    it('hasPreviousPage é true a partir da segunda página', () => {
      expect(PaginacaoHelper.construir([], 50, { page: 2, perPage: 10 }).hasPreviousPage).toBe(true);
    });

    it('hasNextPage é true quando há mais páginas', () => {
      expect(PaginacaoHelper.construir([], 50, { page: 1, perPage: 10 }).hasNextPage).toBe(true);
    });

    it('hasNextPage é false na última página', () => {
      expect(PaginacaoHelper.construir([], 10, { page: 1, perPage: 10 }).hasNextPage).toBe(false);
    });
  });

  describe('padrao()', () => {
    it('retorna page=1 e perPage=20', () => {
      expect(PaginacaoHelper.padrao()).toEqual({ page: 1, perPage: 20 });
    });
  });
});
