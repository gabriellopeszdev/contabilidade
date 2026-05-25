import { describe, it, expect } from 'vitest';
import { Result, isOk, isFail } from '../../src/shared/Result';

describe('Result', () => {
  describe('Result.ok', () => {
    it('ok é true', () => {
      expect(Result.ok(42).ok).toBe(true);
    });

    it('carrega o valor correto', () => {
      const r = Result.ok('hello');
      if (r.ok) expect(r.value).toBe('hello');
    });

    it('funciona com objetos', () => {
      const obj = { id: '1', nome: 'Empresa' };
      const r = Result.ok(obj);
      if (r.ok) expect(r.value).toEqual(obj);
    });

    it('funciona com null', () => {
      const r = Result.ok(null);
      if (r.ok) expect(r.value).toBeNull();
    });

    it('o objeto retornado é imutável', () => {
      expect(Object.isFrozen(Result.ok(42))).toBe(true);
    });
  });

  describe('Result.fail', () => {
    it('ok é false', () => {
      expect(Result.fail(new Error('x')).ok).toBe(false);
    });

    it('carrega o erro correto', () => {
      const err = new Error('falhou');
      const r = Result.fail(err);
      if (!r.ok) expect(r.error).toBe(err);
    });

    it('preserva o tipo customizado do erro', () => {
      class ErroNegocio extends Error {}
      const r = Result.fail(new ErroNegocio('regra violada'));
      if (!r.ok) expect(r.error).toBeInstanceOf(ErroNegocio);
    });

    it('o objeto retornado é imutável', () => {
      expect(Object.isFrozen(Result.fail(new Error()))).toBe(true);
    });
  });

  describe('Result.isOk', () => {
    it('retorna true para sucesso', () => {
      expect(Result.isOk(Result.ok(1))).toBe(true);
    });

    it('retorna false para falha', () => {
      expect(Result.isOk(Result.fail(new Error()))).toBe(false);
    });
  });

  describe('Result.isFail', () => {
    it('retorna true para falha', () => {
      expect(Result.isFail(Result.fail(new Error()))).toBe(true);
    });

    it('retorna false para sucesso', () => {
      expect(Result.isFail(Result.ok(1))).toBe(false);
    });
  });

  describe('funções standalone isOk / isFail', () => {
    it('isOk retorna true para sucesso', () => {
      expect(isOk(Result.ok('x'))).toBe(true);
    });

    it('isFail retorna true para falha', () => {
      expect(isFail(Result.fail(new Error()))).toBe(true);
    });

    it('isOk pode ser usado em .filter() mantendo tipagem', () => {
      const lista = [Result.ok(1), Result.fail(new Error()), Result.ok(3)];
      const sucessos = lista.filter(isOk);
      expect(sucessos).toHaveLength(2);
      expect(sucessos[0].value).toBe(1);
      expect(sucessos[1].value).toBe(3);
    });

    it('isFail pode ser usado em .filter()', () => {
      const lista = [Result.ok(1), Result.fail(new Error('a')), Result.fail(new Error('b'))];
      const falhas = lista.filter(isFail);
      expect(falhas).toHaveLength(2);
    });
  });
});
