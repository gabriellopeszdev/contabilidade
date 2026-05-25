import { describe, it, expect } from 'vitest';
import { Email } from '../../../src/domain/value-objects/Email';
import { DomainException } from '../../../src/domain/exceptions/DomainException';

describe('Email', () => {
  describe('construção com e-mail válido', () => {
    const validos = [
      'usuario@dominio.com',
      'user.name+tag@example.com.br',
      'admin@sub.dominio.org',
      'a@b.cc',
      'test123@empresa.io',
    ];

    it.each(validos)('aceita "%s"', (email) => {
      expect(() => new Email(email)).not.toThrow();
    });

    it('normaliza para minúsculas', () => {
      expect(new Email('Usuario@DOMINIO.COM').value).toBe('usuario@dominio.com');
    });

    it('remove espaços nas bordas', () => {
      expect(new Email('  user@test.com  ').value).toBe('user@test.com');
    });

    it('toString() retorna o e-mail normalizado', () => {
      expect(String(new Email('ADMIN@EMPRESA.COM'))).toBe('admin@empresa.com');
    });
  });

  describe('igualdade', () => {
    it('dois e-mails iguais (mesmo case) são iguais', () => {
      expect(new Email('a@b.com').equals(new Email('a@b.com'))).toBe(true);
    });

    it('dois e-mails com casing diferente são iguais após normalização', () => {
      expect(new Email('USER@EXAMPLE.COM').equals(new Email('user@example.com'))).toBe(true);
    });

    it('e-mails com local diferente não são iguais', () => {
      expect(new Email('admin@example.com').equals(new Email('user@example.com'))).toBe(false);
    });
  });

  describe('rejeição de e-mails inválidos', () => {
    const invalidos = [
      ['string vazia',          ''],
      ['sem @',                 'semArroba'],
      ['sem usuário',           '@dominio.com'],
      ['sem domínio',           'user@'],
      ['sem TLD',               'user@dominio'],
      ['espaço no meio',        'user @dominio.com'],
      ['@ duplo',               'user@@dominio.com'],
    ] as const;

    it.each(invalidos)('lança DomainException: %s', (_, email) => {
      expect(() => new Email(email)).toThrow(DomainException);
    });

    it('lança DomainException para e-mail com mais de 255 caracteres', () => {
      const longo = 'a'.repeat(250) + '@x.com'; // 256 chars > 255
      expect(() => new Email(longo)).toThrow(DomainException);
    });
  });
});
