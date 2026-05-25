import { describe, it, expect } from 'vitest';
import { CRC } from '../../../src/domain/value-objects/CRC';
import { DomainException } from '../../../src/domain/exceptions/DomainException';

describe('CRC', () => {
  describe('formatos aceitos no input', () => {
    const casos = [
      ['CRC-SP/123456', 'SP', '123456'],
      ['CRCSP123456',   'SP', '123456'],
      ['SP/123456',     'SP', '123456'],
      ['CRC-RJ/1',      'RJ', '000001'],
      ['crc-mg/999999', 'MG', '999999'], // lowercase
    ] as [string, string, string][];

    it.each(casos)('aceita "%s" → UF=%s número=%s', (input, uf, numero) => {
      const crc = new CRC(input);
      expect(crc.uf).toBe(uf);
      expect(crc.numero).toBe(numero);
    });
  });

  describe('formato canônico', () => {
    it('formatar() retorna "CRC-UF/NNNNNN"', () => {
      expect(new CRC('SP/123456').formatar()).toBe('CRC-SP/123456');
    });

    it('aplica zero-padding em números curtos', () => {
      const crc = new CRC('CRC-SP/1');
      expect(crc.numero).toBe('000001');
      expect(crc.formatar()).toBe('CRC-SP/000001');
    });

    it('toString() retorna formato canônico', () => {
      expect(String(new CRC('CRCSP42000'))).toBe('CRC-SP/042000');
    });
  });

  describe('igualdade', () => {
    it('mesmo CRC em formatos diferentes são iguais', () => {
      expect(new CRC('CRC-SP/123456').equals(new CRC('CRCSP123456'))).toBe(true);
    });

    it('UFs diferentes → não iguais', () => {
      expect(new CRC('CRC-SP/123456').equals(new CRC('CRC-RJ/123456'))).toBe(false);
    });

    it('números diferentes → não iguais', () => {
      expect(new CRC('CRC-SP/111111').equals(new CRC('CRC-SP/222222'))).toBe(false);
    });
  });

  describe('todos os 27 estados são aceitos', () => {
    const ufs = [
      'AC','AL','AP','AM','BA','CE','DF','ES','GO',
      'MA','MT','MS','MG','PA','PB','PR','PE','PI',
      'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
    ];

    it.each(ufs)('aceita UF=%s', (uf) => {
      expect(() => new CRC(`CRC-${uf}/100000`)).not.toThrow();
    });
  });

  describe('rejeição de valores inválidos', () => {
    it('lança DomainException para string vazia', () => {
      expect(() => new CRC('')).toThrow(DomainException);
    });

    it('lança DomainException para UF inexistente (XX)', () => {
      expect(() => new CRC('CRC-XX/123456')).toThrow(DomainException);
    });

    it('lança DomainException para formato sem UF', () => {
      expect(() => new CRC('123456')).toThrow(DomainException);
    });
  });
});
