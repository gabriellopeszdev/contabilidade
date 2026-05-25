import { describe, it, expect } from 'vitest';
import { Setor } from '../../../src/domain/value-objects/Setor';
import { DomainException } from '../../../src/domain/exceptions/DomainException';

describe('Setor', () => {
  describe('construção direta', () => {
    it('aceita FISCAL', () => {
      expect(() => new Setor('FISCAL')).not.toThrow();
    });

    it('aceita PESSOAL', () => {
      expect(() => new Setor('PESSOAL')).not.toThrow();
    });

    it('aceita CONTABIL', () => {
      expect(() => new Setor('CONTABIL')).not.toThrow();
    });

    it('aceita TODOS', () => {
      expect(() => new Setor('TODOS')).not.toThrow();
    });

    it('lança DomainException para setor inválido', () => {
      // @ts-expect-error — teste intencional com valor inválido
      expect(() => new Setor('INVALIDO')).toThrow(DomainException);
    });
  });

  describe('constantes pré-instanciadas', () => {
    it('Setor.FISCAL.tipo === "FISCAL"', () => {
      expect(Setor.FISCAL.tipo).toBe('FISCAL');
    });

    it('Setor.PESSOAL.tipo === "PESSOAL"', () => {
      expect(Setor.PESSOAL.tipo).toBe('PESSOAL');
    });

    it('Setor.CONTABIL.tipo === "CONTABIL"', () => {
      expect(Setor.CONTABIL.tipo).toBe('CONTABIL');
    });

    it('Setor.TODOS.tipo === "TODOS"', () => {
      expect(Setor.TODOS.tipo).toBe('TODOS');
    });
  });

  describe('fromString()', () => {
    it('aceita "fiscal" (lowercase)', () => {
      expect(Setor.fromString('fiscal').tipo).toBe('FISCAL');
    });

    it('aceita "PESSOAL"', () => {
      expect(Setor.fromString('PESSOAL').tipo).toBe('PESSOAL');
    });

    it('aceita "todos"', () => {
      expect(Setor.fromString('todos').tipo).toBe('TODOS');
    });

    it('lança DomainException para string inválida', () => {
      expect(() => Setor.fromString('DESCONHECIDO')).toThrow(DomainException);
    });

    it('lança DomainException para string vazia', () => {
      expect(() => Setor.fromString('')).toThrow(DomainException);
    });
  });

  describe('metadados de retenção', () => {
    it('FISCAL tem retencaoMinimaEmMeses = 60', () => {
      expect(Setor.FISCAL.retencaoMinimaEmMeses).toBe(60);
    });

    it('PESSOAL tem retencaoMinimaEmMeses = 60', () => {
      expect(Setor.PESSOAL.retencaoMinimaEmMeses).toBe(60);
    });

    it('CONTABIL tem retencaoMinimaEmMeses = 60', () => {
      expect(Setor.CONTABIL.retencaoMinimaEmMeses).toBe(60);
    });

    it('descricao não é vazia para setores reais', () => {
      expect(Setor.FISCAL.descricao.length).toBeGreaterThan(0);
      expect(Setor.PESSOAL.descricao.length).toBeGreaterThan(0);
      expect(Setor.CONTABIL.descricao.length).toBeGreaterThan(0);
    });
  });

  describe('equals()', () => {
    it('mesmo setor são iguais', () => {
      expect(new Setor('FISCAL').equals(new Setor('FISCAL'))).toBe(true);
    });

    it('setores diferentes não são iguais', () => {
      expect(new Setor('FISCAL').equals(new Setor('PESSOAL'))).toBe(false);
    });

    it('constante pré-instanciada é igual à instância criada', () => {
      expect(Setor.FISCAL.equals(new Setor('FISCAL'))).toBe(true);
    });
  });

  describe('toString() / toJSON()', () => {
    it('toString retorna o tipo', () => {
      expect(Setor.CONTABIL.toString()).toBe('CONTABIL');
    });

    it('toJSON retorna o tipo', () => {
      expect(Setor.PESSOAL.toJSON()).toBe('PESSOAL');
    });
  });

  describe('todosOsTipos()', () => {
    it('retorna FISCAL, PESSOAL e CONTABIL', () => {
      const tipos = Setor.todosOsTipos();
      expect(tipos).toContain('FISCAL');
      expect(tipos).toContain('PESSOAL');
      expect(tipos).toContain('CONTABIL');
    });

    it('não inclui TODOS', () => {
      expect(Setor.todosOsTipos()).not.toContain('TODOS');
    });
  });
});
