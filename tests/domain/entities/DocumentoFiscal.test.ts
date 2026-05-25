import { describe, it, expect } from 'vitest';
import { DocumentoFiscal } from '../../../src/domain/entities/DocumentoFiscal';
import { Setor } from '../../../src/domain/value-objects/Setor';
import { DomainException } from '../../../src/domain/exceptions/DomainException';

function propsBase() {
  return {
    id: 'doc-001',
    clientId: 'cliente-001',
    uploadedById: 'contador-001',
    sector: Setor.FISCAL,
    fileName: 'nota_fiscal.xml',
    storagePath: 'cliente-001/FISCAL/2026-05/uuid.xml',
    fileType: 'XML' as const,
    fileSizeBytes: 1024,
    fileHash: 'abc123def456',
    competencia: null,
    metadataJson: {},
  };
}

describe('DocumentoFiscal', () => {
  describe('criar()', () => {
    it('cria com readStatus = false por padrão', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      expect(doc.readStatus).toBe(false);
    });

    it('cria com readAt = null por padrão', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      expect(doc.readAt).toBeNull();
    });

    it('expõe os campos corretos', () => {
      const p = propsBase();
      const doc = DocumentoFiscal.criar(p);
      expect(doc.id).toBe(p.id);
      expect(doc.clientId).toBe(p.clientId);
      expect(doc.uploadedById).toBe(p.uploadedById);
      expect(doc.fileName).toBe(p.fileName);
      expect(doc.storagePath).toBe(p.storagePath);
      expect(doc.fileType).toBe('XML');
      expect(doc.fileSizeBytes).toBe(1024);
      expect(doc.fileHash).toBe('abc123def456');
    });

    it('lança DomainException para id vazio', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), id: '' })).toThrow(DomainException);
    });

    it('lança DomainException para clientId vazio', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), clientId: '' })).toThrow(DomainException);
    });

    it('lança DomainException para uploadedById vazio', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), uploadedById: '' })).toThrow(DomainException);
    });

    it('lança DomainException para fileName vazio', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), fileName: '' })).toThrow(DomainException);
    });

    it('lança DomainException para storagePath vazio', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), storagePath: '' })).toThrow(DomainException);
    });

    it('lança DomainException para fileSizeBytes = 0', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), fileSizeBytes: 0 })).toThrow(DomainException);
    });

    it('lança DomainException para fileSizeBytes negativo', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), fileSizeBytes: -1 })).toThrow(DomainException);
    });

    it('lança DomainException para fileHash vazio', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), fileHash: '' })).toThrow(DomainException);
    });

    it('lança DomainException para fileType inválido', () => {
      // @ts-expect-error — teste intencional
      expect(() => DocumentoFiscal.criar({ ...propsBase(), fileType: 'DOCX' })).toThrow(DomainException);
    });

    it('aceita fileType PDF', () => {
      expect(() => DocumentoFiscal.criar({ ...propsBase(), fileType: 'PDF' })).not.toThrow();
    });
  });

  describe('reconstituir()', () => {
    it('reconstitui com readStatus = true', () => {
      const doc = DocumentoFiscal.reconstituir({
        ...propsBase(),
        readStatus: true,
        readAt: new Date('2026-01-01'),
        createdAt: new Date(),
      });
      expect(doc.readStatus).toBe(true);
      expect(doc.readAt).toBeInstanceOf(Date);
    });
  });

  describe('registrarVisualizacao()', () => {
    it('muda readStatus para true na primeira chamada', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      doc.registrarVisualizacao();
      expect(doc.readStatus).toBe(true);
    });

    it('define readAt na primeira chamada', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      doc.registrarVisualizacao();
      expect(doc.readAt).toBeInstanceOf(Date);
    });

    it('emite evento de domínio na primeira chamada', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      doc.registrarVisualizacao();
      const eventos = doc.peekDomainEvents();
      expect(eventos).toHaveLength(1);
      expect(eventos[0].eventName).toBe('DocumentoVisualizadoEvent');
    });

    it('é idempotente — segunda chamada não muda estado nem emite evento', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      doc.registrarVisualizacao();
      const readAtPrimeiro = doc.readAt;
      doc.registrarVisualizacao();
      expect(doc.peekDomainEvents()).toHaveLength(1);
      expect(doc.readAt).toBe(readAtPrimeiro);
    });
  });

  describe('marcarComoLido()', () => {
    it('força readStatus = true', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      doc.marcarComoLido();
      expect(doc.readStatus).toBe(true);
    });

    it('define readAt', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      doc.marcarComoLido();
      expect(doc.readAt).toBeInstanceOf(Date);
    });
  });

  describe('validarIntegridade()', () => {
    it('retorna true quando o hash bate', () => {
      const conteudo = Buffer.from('conteudo do arquivo');
      const hash = DocumentoFiscal.gerarHash(conteudo);
      const doc = DocumentoFiscal.criar({ ...propsBase(), fileHash: hash });
      expect(doc.validarIntegridade(conteudo)).toBe(true);
    });

    it('retorna false quando o conteúdo foi alterado', () => {
      const original = Buffer.from('conteudo original');
      const hash = DocumentoFiscal.gerarHash(original);
      const doc = DocumentoFiscal.criar({ ...propsBase(), fileHash: hash });
      expect(doc.validarIntegridade(Buffer.from('conteudo alterado'))).toBe(false);
    });
  });

  describe('gerarHash()', () => {
    it('retorna string hexadecimal de 64 caracteres (SHA-256)', () => {
      const hash = DocumentoFiscal.gerarHash(Buffer.from('teste'));
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('mesmo conteúdo gera mesmo hash', () => {
      const buf = Buffer.from('mesmo conteudo');
      expect(DocumentoFiscal.gerarHash(buf)).toBe(DocumentoFiscal.gerarHash(buf));
    });

    it('conteúdos diferentes geram hashes diferentes', () => {
      expect(DocumentoFiscal.gerarHash(Buffer.from('a'))).not.toBe(
        DocumentoFiscal.gerarHash(Buffer.from('b')),
      );
    });
  });

  describe('pullDomainEvents()', () => {
    it('retorna os eventos acumulados e limpa a fila', () => {
      const doc = DocumentoFiscal.criar(propsBase());
      doc.registrarVisualizacao();
      const eventos = doc.pullDomainEvents();
      expect(eventos).toHaveLength(1);
      expect(doc.pullDomainEvents()).toHaveLength(0);
    });
  });
});
