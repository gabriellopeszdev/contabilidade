import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessarUploadLoteUseCase } from '../../src/application/use-cases/ProcessarUploadLoteUseCase';
import { DomainException } from '../../src/domain/exceptions/DomainException';
import type { IDocumentoRepository } from '../../src/domain/ports/IDocumentoRepository';
import type { IStorageService } from '../../src/domain/ports/IStorageService';
import type { IAuditLogRepository } from '../../src/domain/ports/IAuditLogRepository';
import type { IEventDispatcher } from '../../src/domain/ports/IEventDispatcher';
import type { ProcessarUploadLoteInputDTO } from '../../src/application/dtos/UploadLoteDTO';

function criarMocks() {
  const documentoRepository: IDocumentoRepository = {
    salvar: vi.fn(),
    salvarLote: vi.fn().mockResolvedValue(undefined),
    buscarPorId: vi.fn(),
    listarPorCliente: vi.fn(),
    hashJaExiste: vi.fn().mockResolvedValue(false),
    atualizar: vi.fn(),
    deletar: vi.fn(),
    listarTodosDoClienteParaOffboarding: vi.fn(),
  };
  const storageService: IStorageService = {
    upload: vi.fn().mockResolvedValue(undefined),
    deletar: vi.fn(),
    deletarLote: vi.fn(),
    gerarPresignedUrlUpload: vi.fn(),
    gerarPresignedUrlDownload: vi.fn(),
    verificarExistencia: vi.fn(),
    copiar: vi.fn(),
    getBuffer: vi.fn(),
  };
  const auditLogRepository: IAuditLogRepository = {
    salvar: vi.fn().mockResolvedValue(undefined),
    salvarLote: vi.fn(),
    listar: vi.fn(),
    listarPorClienteParaOffboarding: vi.fn(),
  };
  const eventDispatcher: IEventDispatcher = {
    dispatch: vi.fn().mockResolvedValue(undefined),
    dispatchAll: vi.fn(),
  };
  return { documentoRepository, storageService, auditLogRepository, eventDispatcher };
}

function criarArquivo(overrides: Partial<{
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  conteudo: Buffer;
}> = {}) {
  const conteudo = overrides.conteudo ?? Buffer.from('conteudo teste xml');
  return {
    fileName: 'nota.xml',
    mimeType: 'application/xml',
    fileSizeBytes: conteudo.byteLength,
    conteudo,
    ...overrides,
  };
}

function inputBase(overrides: Partial<ProcessarUploadLoteInputDTO> = {}): ProcessarUploadLoteInputDTO {
  return {
    clienteId: 'cliente-001',
    contadorId: 'contador-001',
    sector: 'FISCAL',
    arquivos: [criarArquivo()],
    ipAddress: '127.0.0.1',
    ...overrides,
  };
}

describe('ProcessarUploadLoteUseCase', () => {
  let mocks: ReturnType<typeof criarMocks>;
  let useCase: ProcessarUploadLoteUseCase;

  beforeEach(() => {
    mocks = criarMocks();
    useCase = new ProcessarUploadLoteUseCase(
      mocks.documentoRepository,
      mocks.storageService,
      mocks.auditLogRepository,
      mocks.eventDispatcher,
    );
  });

  describe('validação global de input', () => {
    it('lança DomainException para clienteId vazio', async () => {
      await expect(useCase.executar(inputBase({ clienteId: '' }))).rejects.toThrow(DomainException);
    });

    it('lança DomainException para contadorId vazio', async () => {
      await expect(useCase.executar(inputBase({ contadorId: '' }))).rejects.toThrow(DomainException);
    });

    it('lança DomainException para ipAddress vazio', async () => {
      await expect(useCase.executar(inputBase({ ipAddress: '' }))).rejects.toThrow(DomainException);
    });

    it('lança DomainException para lote vazio', async () => {
      await expect(useCase.executar(inputBase({ arquivos: [] }))).rejects.toThrow(DomainException);
    });

    it('lança DomainException para lote com mais de 50 arquivos', async () => {
      const arquivos = Array.from({ length: 51 }, () => criarArquivo());
      await expect(useCase.executar(inputBase({ arquivos }))).rejects.toThrow(DomainException);
    });

    it('lança DomainException para setor inválido', async () => {
      // @ts-expect-error — teste intencional
      await expect(useCase.executar(inputBase({ sector: 'INVALIDO' }))).rejects.toThrow(DomainException);
    });
  });

  describe('upload bem-sucedido', () => {
    it('retorna totalArquivos correto', async () => {
      const result = await useCase.executar(inputBase());
      expect(result.totalArquivos).toBe(1);
    });

    it('retorna o arquivo na lista uploadados', async () => {
      const result = await useCase.executar(inputBase());
      expect(result.uploadados).toHaveLength(1);
      expect(result.uploadados[0].fileName).toBe('nota.xml');
    });

    it('retorna lista de falhas vazia', async () => {
      const result = await useCase.executar(inputBase());
      expect(result.falhas).toHaveLength(0);
    });

    it('chama storageService.upload uma vez', async () => {
      await useCase.executar(inputBase());
      expect(mocks.storageService.upload).toHaveBeenCalledOnce();
    });

    it('chama documentoRepository.salvarLote com um documento', async () => {
      await useCase.executar(inputBase());
      expect(mocks.documentoRepository.salvarLote).toHaveBeenCalledOnce();
    });

    it('despacha evento após o upload', async () => {
      await useCase.executar(inputBase());
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledOnce();
    });

    it('usa loteId fornecido no input quando presente', async () => {
      const result = await useCase.executar(inputBase({ loteId: 'lote-fixo-001' }));
      expect(result.loteId).toBe('lote-fixo-001');
    });

    it('gera loteId automaticamente quando não fornecido', async () => {
      const result = await useCase.executar(inputBase());
      expect(result.loteId).toBeTruthy();
      expect(typeof result.loteId).toBe('string');
    });

    it('retorna fileHash no resultado', async () => {
      const result = await useCase.executar(inputBase());
      expect(result.uploadados[0].fileHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('rejeição de MIME type inválido', () => {
    it('coloca arquivo com MIME inválido na lista de falhas', async () => {
      const arquivo = criarArquivo({ mimeType: 'image/jpeg' });
      const result = await useCase.executar(inputBase({ arquivos: [arquivo] }));
      expect(result.falhas).toHaveLength(1);
      expect(result.falhas[0].fileName).toBe('nota.xml');
      expect(result.uploadados).toHaveLength(0);
    });

    it('aceita application/pdf', async () => {
      const conteudo = Buffer.from('pdf binario');
      const arquivo = criarArquivo({ fileName: 'doc.pdf', mimeType: 'application/pdf', conteudo, fileSizeBytes: conteudo.byteLength });
      const result = await useCase.executar(inputBase({ arquivos: [arquivo] }));
      expect(result.uploadados).toHaveLength(1);
    });

    it('aceita text/xml', async () => {
      const conteudo = Buffer.from('<xml/>');
      const arquivo = criarArquivo({ mimeType: 'text/xml', conteudo, fileSizeBytes: conteudo.byteLength });
      const result = await useCase.executar(inputBase({ arquivos: [arquivo] }));
      expect(result.uploadados).toHaveLength(1);
    });
  });

  describe('rejeição por tamanho', () => {
    it('coloca na lista de falhas arquivo maior que 10MB', async () => {
      const conteudo = Buffer.alloc(1);
      const arquivo = criarArquivo({
        fileSizeBytes: 10 * 1_048_576 + 1,
        conteudo: Buffer.alloc(10 * 1_048_576 + 1),
      });
      const result = await useCase.executar(inputBase({ arquivos: [arquivo] }));
      expect(result.falhas).toHaveLength(1);
    });
  });

  describe('deduplicação por hash', () => {
    it('rejeita arquivo duplicado (hash já existe)', async () => {
      vi.mocked(mocks.documentoRepository.hashJaExiste).mockResolvedValue(true);
      const result = await useCase.executar(inputBase());
      expect(result.falhas).toHaveLength(1);
      expect(result.uploadados).toHaveLength(0);
    });
  });

  describe('falhas parciais', () => {
    it('processa válidos mesmo com um arquivo inválido no lote', async () => {
      const valido = criarArquivo({ fileName: 'valido.xml' });
      const invalido = criarArquivo({ fileName: 'invalido.jpg', mimeType: 'image/jpeg' });

      const result = await useCase.executar(inputBase({ arquivos: [valido, invalido] }));
      expect(result.uploadados).toHaveLength(1);
      expect(result.falhas).toHaveLength(1);
      expect(result.uploadados[0].fileName).toBe('valido.xml');
      expect(result.falhas[0].fileName).toBe('invalido.jpg');
    });
  });

  describe('falha no audit log (fire-and-forget)', () => {
    it('não interrompe o upload quando audit log falha', async () => {
      vi.mocked(mocks.auditLogRepository.salvar).mockRejectedValue(new Error('DB timeout'));
      await expect(useCase.executar(inputBase())).resolves.toBeDefined();
    });
  });
});
