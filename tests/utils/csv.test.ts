import { describe, it, expect } from 'vitest';
import { toCSV } from '../../src/utils/csv';

describe('toCSV', () => {
  describe('cabeçalho', () => {
    it('gera linha de cabeçalho com colunas simples', () => {
      const csv = toCSV(['Nome', 'Email', 'Valor'], []);
      const linhas = csv.split('\r\n');
      expect(linhas[0]).toBe('Nome,Email,Valor');
    });

    it('escapa cabeçalho com vírgula', () => {
      const csv = toCSV(['Nome, Completo', 'Valor'], []);
      expect(csv.split('\r\n')[0]).toBe('"Nome, Completo",Valor');
    });
  });

  describe('linhas de dados', () => {
    it('gera linha de dados simples', () => {
      const csv = toCSV(['A', 'B'], [['foo', 'bar']]);
      const linhas = csv.split('\r\n');
      expect(linhas[1]).toBe('foo,bar');
    });

    it('gera múltiplas linhas', () => {
      const csv = toCSV(['N'], [['linha1'], ['linha2'], ['linha3']]);
      const linhas = csv.split('\r\n');
      expect(linhas).toHaveLength(4); // cabeçalho + 3 linhas
      expect(linhas[1]).toBe('linha1');
      expect(linhas[2]).toBe('linha2');
      expect(linhas[3]).toBe('linha3');
    });
  });

  describe('escaping de campos', () => {
    it('envolve em aspas campo com vírgula', () => {
      const csv = toCSV(['A'], [['valor,com,virgulas']]);
      expect(csv.split('\r\n')[1]).toBe('"valor,com,virgulas"');
    });

    it('envolve em aspas campo com aspas duplas e escapa as aspas', () => {
      const csv = toCSV(['A'], [['diz "olá"']]);
      expect(csv.split('\r\n')[1]).toBe('"diz ""olá"""');
    });

    it('envolve em aspas campo com quebra de linha \\n', () => {
      const csv = toCSV(['A'], [['linha1\nlinha2']]);
      expect(csv.split('\r\n')[1]).toBe('"linha1\nlinha2"');
    });

    it('envolve em aspas campo com \\r', () => {
      const csv = toCSV(['A'], [['texto\routro']]);
      expect(csv.split('\r\n')[1]).toBe('"texto\routro"');
    });

    it('não envolve em aspas campo sem caracteres especiais', () => {
      const csv = toCSV(['A'], [['simples']]);
      expect(csv.split('\r\n')[1]).toBe('simples');
    });

    it('campo vazio não é envolvido em aspas', () => {
      const csv = toCSV(['A', 'B'], [['', 'val']]);
      expect(csv.split('\r\n')[1]).toBe(',val');
    });
  });

  describe('separador de linhas', () => {
    it('usa \\r\\n como separador entre linhas', () => {
      const csv = toCSV(['A'], [['x'], ['y']]);
      expect(csv).toContain('\r\n');
      expect(csv.split('\r\n')).toHaveLength(3);
    });
  });

  describe('sem linhas de dados', () => {
    it('retorna apenas o cabeçalho quando rows é vazio', () => {
      const csv = toCSV(['Coluna1', 'Coluna2'], []);
      expect(csv).toBe('Coluna1,Coluna2');
      expect(csv.split('\r\n')).toHaveLength(1);
    });
  });

  describe('caso completo', () => {
    it('gera CSV completo com escaping e múltiplas linhas', () => {
      const headers = ['Nome', 'Valor', 'Nota'];
      const rows = [
        ['Empresa ABC', '1.500,00', 'OK'],
        ['Diz "olá"', '0', 'linha1\nlinha2'],
      ];
      const csv = toCSV(headers, rows);
      const linhas = csv.split('\r\n');
      expect(linhas[0]).toBe('Nome,Valor,Nota');
      expect(linhas[1]).toBe('Empresa ABC,"1.500,00",OK');
      expect(linhas[2]).toBe('"Diz ""olá""",0,"linha1\nlinha2"');
    });
  });
});
