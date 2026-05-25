import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistrarLeituraDocumentoUseCase } from '../../src/application/use-cases/RegistrarLeituraDocumentoUseCase';
import { DocumentoFiscal } from '../../src/domain/entities/DocumentoFiscal';
import { Setor } from '../../src/domain/value-objects/Setor';
import { DomainException } from '../../src/domain/exceptions/DomainException';
import type { IDocumentoRepository } from '../../src/domain/ports/IDocumentoRepository';
import type { IAuditLogRepository } from '../../src/domain/ports/IAuditLogRepository';
import type { IEventDispatcher } from '../../src/domain/ports/IEventDispatcher';

function criarDocumento(readStatus = false) {
  const doc = DocumentoFiscal.reconstituir({
    id: 'doc-001',
    clientId: 'cliente-001',
    uploadedById: 'contador-001',
    sector: Setor.FISCAL,
    fileName: 'nota.xml',
    storagePath: 'cliente-001/FISCAL/2026-05/uuid.xml',
    fileType: 'XML',
    fileSizeBytes: 1024,
    fileHash: 'abc123',
    readStatus,
    readAt: readStatus ? new Date('2026-01-01') : null,
    competencia: null,
    metadataJson: {},
    createdAt: new Date(),
  });
  return doc;
}

function criarMocks() {
  const documentoRepository: IDocumentoRepository = {
    salvar: vi.fn(),
    salvarLote: vi.fn(),
    buscarPorId: vi.fn(),
    listarPorCliente: vi.fn(),
    hashJaExiste: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
    listarTodosDoClienteParaOffboarding: vi.fn(),
  };
  const auditLogRepository: IAuditLogRepository = {
    salvar: vi.fn(),
    salvarLote: vi.fn(),
    listar: vi.fn(),
    listarPorClienteParaOffboarding: vi.fn(),
  };
  const eventDispatcher: IEventDispatcher = {
    dispatch: vi.fn(),
    dispatchAll: vi.fn(),
  };
  return { documentoRepository, auditLogRepository, eventDispatcher };
}

function inputBase() {
  return {
    documentoId: 'doc-001',
    clienteId: 'cliente-001',
    contadorResponsavelId: 'contador-001',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    visualizadoPorId: 'cliente-001',
    visualizadoPorRole: 'CLIENT' as const,
  };
}

describe('RegistrarLeituraDocumentoUseCase', () => {
  let mocks: ReturnType<typeof criarMocks>;
  let useCase: RegistrarLeituraDocumentoUseCase;

  beforeEach(() => {
    mocks = criarMocks();
    useCase = new RegistrarLeituraDocumentoUseCase(
      mocks.documentoRepository,
      mocks.auditLogRepository,
      mocks.eventDispatcher,
    );
  });

  describe('validação de input', () => {
    it('lança DomainException para documentoId vazio', async () => {
      await expect(
        useCase.executar({ ...inputBase(), documentoId: '' }),
      ).rejects.toThrow(DomainException);
    });

    it('lança DomainException para clienteId vazio', async () => {
      await expect(
        useCase.executar({ ...inputBase(), clienteId: '' }),
      ).rejects.toThrow(DomainException);
    });

    it('lança DomainException para ipAddress vazio', async () => {
      await expect(
        useCase.executar({ ...inputBase(), ipAddress: '' }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('documento não encontrado', () => {
    it('lança DomainException quando documento não existe', async () => {
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(null);
      await expect(useCase.executar(inputBase())).rejects.toThrow(DomainException);
    });
  });

  describe('verificação de ownership', () => {
    it('lança DomainException quando clienteId não corresponde ao dono do documento', async () => {
      const doc = criarDocumento();
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      await expect(
        useCase.executar({ ...inputBase(), clienteId: 'outro-cliente' }),
      ).rejects.toThrow(DomainException);
    });
  });

  describe('primeira leitura', () => {
    it('retorna primeiraLeitura = true', async () => {
      const doc = criarDocumento(false);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.documentoRepository.atualizar).mockResolvedValue();
      vi.mocked(mocks.auditLogRepository.salvar).mockResolvedValue();
      vi.mocked(mocks.eventDispatcher.dispatch).mockResolvedValue();

      const result = await useCase.executar(inputBase());
      expect(result.primeiraLeitura).toBe(true);
    });

    it('persiste a atualização no repositório', async () => {
      const doc = criarDocumento(false);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.documentoRepository.atualizar).mockResolvedValue();
      vi.mocked(mocks.auditLogRepository.salvar).mockResolvedValue();
      vi.mocked(mocks.eventDispatcher.dispatch).mockResolvedValue();

      await useCase.executar(inputBase());
      expect(mocks.documentoRepository.atualizar).toHaveBeenCalledOnce();
    });

    it('despacha evento de domínio', async () => {
      const doc = criarDocumento(false);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.documentoRepository.atualizar).mockResolvedValue();
      vi.mocked(mocks.auditLogRepository.salvar).mockResolvedValue();
      vi.mocked(mocks.eventDispatcher.dispatch).mockResolvedValue();

      await useCase.executar(inputBase());
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledOnce();
    });

    it('retorna nomeArquivo e readAt', async () => {
      const doc = criarDocumento(false);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.documentoRepository.atualizar).mockResolvedValue();
      vi.mocked(mocks.auditLogRepository.salvar).mockResolvedValue();
      vi.mocked(mocks.eventDispatcher.dispatch).mockResolvedValue();

      const result = await useCase.executar(inputBase());
      expect(result.nomeArquivo).toBe('nota.xml');
      expect(result.readAt).toBeInstanceOf(Date);
    });
  });

  describe('leitura repetida (idempotência)', () => {
    it('retorna primeiraLeitura = false', async () => {
      const doc = criarDocumento(true);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.auditLogRepository.salvar).mockResolvedValue();

      const result = await useCase.executar(inputBase());
      expect(result.primeiraLeitura).toBe(false);
    });

    it('não chama atualizar() no repositório', async () => {
      const doc = criarDocumento(true);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.auditLogRepository.salvar).mockResolvedValue();

      await useCase.executar(inputBase());
      expect(mocks.documentoRepository.atualizar).not.toHaveBeenCalled();
    });

    it('não despacha evento', async () => {
      const doc = criarDocumento(true);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.auditLogRepository.salvar).mockResolvedValue();

      await useCase.executar(inputBase());
      expect(mocks.eventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('salva audit log mesmo em leitura repetida', async () => {
      const doc = criarDocumento(true);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.auditLogRepository.salvar).mockResolvedValue();

      await useCase.executar(inputBase());
      expect(mocks.auditLogRepository.salvar).toHaveBeenCalledOnce();
    });
  });

  describe('falha no audit log (fire-and-forget)', () => {
    it('não falha a operação principal quando audit log lança erro', async () => {
      const doc = criarDocumento(false);
      vi.mocked(mocks.documentoRepository.buscarPorId).mockResolvedValue(doc);
      vi.mocked(mocks.documentoRepository.atualizar).mockResolvedValue();
      vi.mocked(mocks.auditLogRepository.salvar).mockRejectedValue(new Error('DB timeout'));
      vi.mocked(mocks.eventDispatcher.dispatch).mockResolvedValue();

      await expect(useCase.executar(inputBase())).resolves.toBeDefined();
    });
  });
});
