import { describe, it, expect } from 'vitest';
import { CNPJ } from '../../../src/domain/value-objects/CNPJ';
import { DomainException } from '../../../src/domain/exceptions/DomainException';

describe('CNPJ', () => {
  // CNPJs válidos verificados pelo algoritmo oficial da Receita Federal
  const VALIDOS = [
    '11444777000161',       // Empresa Demo Ltda (dos screenshots)
    '63433714000103',       // Empresa Teste (dos screenshots)
    '11.444.777/0001-61',  // mesmo CNPJ com máscara
    '63.433.714/0001-03',  // mesmo CNPJ com máscara
  ];

  describe('construção com CNPJ válido', () => {
    it.each(VALIDOS)('aceita "%s"', (cnpj) => {
      expect(() => new CNPJ(cnpj)).not.toThrow();
    });

    it('normaliza removendo pontuação', () => {
      const com = new CNPJ('11.444.777/0001-61');
      const sem = new CNPJ('11444777000161');
      expect(com.value).toBe('11444777000161');
      expect(com.equals(sem)).toBe(true);
    });

    it('armazena somente os 14 dígitos', () => {
      const cnpj = new CNPJ('11444777000161');
      expect(cnpj.value).toBe('11444777000161');
      expect(cnpj.value).toHaveLength(14);
    });
  });

  describe('formatação', () => {
    it('formatar() retorna máscara XX.XXX.XXX/XXXX-XX', () => {
      expect(new CNPJ('11444777000161').formatar()).toBe('11.444.777/0001-61');
    });

    it('toString() retorna o mesmo que formatar()', () => {
      const cnpj = new CNPJ('11444777000161');
      expect(String(cnpj)).toBe(cnpj.formatar());
    });
  });

  describe('igualdade', () => {
    it('mesmo CNPJ com e sem máscara são iguais', () => {
      const a = new CNPJ('11444777000161');
      const b = new CNPJ('11.444.777/0001-61');
      expect(a.equals(b)).toBe(true);
    });

    it('CNPJs diferentes não são iguais', () => {
      const a = new CNPJ('11444777000161');
      const b = new CNPJ('63433714000103');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('rejeição de valores inválidos', () => {
    it('lança DomainException para string vazia', () => {
      expect(() => new CNPJ('')).toThrow(DomainException);
    });

    it('lança DomainException para menos de 14 dígitos', () => {
      expect(() => new CNPJ('1234567800010')).toThrow(DomainException);
    });

    it('lança DomainException para mais de 14 dígitos', () => {
      expect(() => new CNPJ('114447770001610')).toThrow(DomainException);
    });

    it('lança DomainException para dígito verificador errado', () => {
      expect(() => new CNPJ('11444777000162')).toThrow(DomainException);
    });

    it('lança DomainException para sequência homogênea 00000000000000', () => {
      expect(() => new CNPJ('00000000000000')).toThrow(DomainException);
    });

    it('lança DomainException para sequência homogênea 11111111111111', () => {
      expect(() => new CNPJ('11111111111111')).toThrow(DomainException);
    });

    it('lança DomainException para letras aleatórias', () => {
      expect(() => new CNPJ('ABCDEFGHIJKLMN')).toThrow(DomainException);
    });
  });
});
