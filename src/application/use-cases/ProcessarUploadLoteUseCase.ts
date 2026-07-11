import { createHash } from 'node:crypto';

import type { IDocumentoRepository } from '../../domain/ports/IDocumentoRepository';
import type { IStorageService } from '../../domain/ports/IStorageService';
import type { IAuditLogRepository } from '../../domain/ports/IAuditLogRepository';
import type { IEventDispatcher } from '../../domain/ports/IEventDispatcher';
import { normalizarPdfBuffer } from '../../infrastructure/pdf/normalizarPdf';

import { DocumentoFiscal } from '../../domain/entities/DocumentoFiscal';
import type { FileType } from '../../domain/entities/DocumentoFiscal';
import { AuditLog } from '../../domain/entities/AuditLog';
import { Setor } from '../../domain/value-objects/Setor';
import { DomainException } from '../../domain/exceptions/DomainException';
import { NovoDocumentoUploadEvent } from '../../domain/events/NovoDocumentoUploadEvent';
import type {
  ArquivoUploadInputDTO,
  ArquivoUploadResultadoDTO,
  ArquivoUploadFalhaDTO,
  ProcessarUploadLoteInputDTO,
  ProcessarUploadLoteOutputDTO,
} from '../dtos/UploadLoteDTO';

// ---------------------------------------------------------------------------
// Constantes de negócio (extraídas para facilitar testes e manutenção)
// ---------------------------------------------------------------------------

const MAX_ARQUIVOS_POR_LOTE = 50;
const MAX_TAMANHO_ARQUIVO_BYTES = 10 * 1_048_576; // 10 MB
const CONCORRENCIA_UPLOAD = 5; // máx de uploads simultâneos ao MinIO
const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 900; // 15 minutos

/** Mapa de MIME type aceito → tipo interno. Factory Method implícito. */
const MIME_PARA_FILETYPE: Readonly<Record<string, FileType>> = {
  'application/xml':  'XML',
  'text/xml':         'XML',
  'application/pdf':  'PDF',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel':                                          'XLS',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword':                                                'DOC',
  'text/csv':                                                          'CSV',
  'application/csv':                                                   'CSV',
  'application/x-ofx':                                                 'OFX',
  'application/ofx':                                                   'OFX',
  'application/vnd.oasis.opendocument.spreadsheet':                    'ODS',
  'application/zip':                                                   'ZIP',
  'application/x-zip-compressed':                                      'ZIP',
  'application/x-zip':                                                 'ZIP',
  'application/x-rar-compressed':                                      'RAR',
  'application/vnd.rar':                                               'RAR',
  'application/x-rar':                                                 'RAR',
} as const;

// ---------------------------------------------------------------------------
// Use Case: ProcessarUploadLoteUseCase
// ---------------------------------------------------------------------------

/**
 * Caso de Uso: ProcessarUploadLoteUseCase
 *
 * Orquestra o fluxo completo de upload em lote de documentos fiscais.
 * Implementa os padrões Facade (orquestração) e Factory Method (validação de tipo).
 *
 * FLUXO (executado arquivo a arquivo em paralelo controlado):
 *   1. Validação global do input (limites, campos obrigatórios)
 *   2. Para cada arquivo — em paralelo (até CONCORRENCIA_UPLOAD simultâneos):
 *      a. Valida MIME type (Factory Method → FileType)
 *      b. Valida tamanho (máx 10MB)
 *      c. Calcula SHA-256 do conteúdo (integridade)
 *      d. Verifica duplicidade no banco (hash + clienteId)
 *      e. Gera o storage path seguindo a convenção arquitetural
 *      f. Faz upload ao MinIO via IStorageService
 *      g. Instancia DocumentoFiscal (entidade rica)
 *   3. Salva todos os documentos bem-sucedidos em lote (transação única)
 *   4. Persiste AuditLog do upload_batch
 *   5. Despacha NovoDocumentoUploadEvent para listeners (WebSocket, notificações)
 *
 * GARANTIAS:
 *   - Falhas parciais não aborta o lote: arquivos válidos são salvos normalmente.
 *   - Arquivos duplicados (mesmo hash + clienteId) são rejeitados silenciosamente.
 *   - Falha no salvamento em lote (DB error) não reverte uploads já feitos no MinIO.
 *     Consistência eventual: o serviço de limpeza de lifecycle trata órfãos.
 *   - O AuditLog e o Event são publicados APÓS a persistência (nunca antes).
 *
 * DEPENDÊNCIAS (todas via injeção — Clean Architecture DIP):
 *   - IDocumentoRepository: persistência dos metadados
 *   - IStorageService: upload dos binários ao MinIO
 *   - IAuditLogRepository: registro imutável da operação
 *   - IEventDispatcher: publicação do evento de domínio
 */
export class ProcessarUploadLoteUseCase {
  constructor(
    private readonly documentoRepository: IDocumentoRepository,
    private readonly storageService: IStorageService,
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly eventDispatcher: IEventDispatcher,
  ) {}

  // ---------------------------------------------------------------------------
  // Método principal
  // ---------------------------------------------------------------------------

  async executar(
    input: ProcessarUploadLoteInputDTO,
  ): Promise<ProcessarUploadLoteOutputDTO> {
    this.validarInputGlobal(input);

    const loteId = input.loteId ?? crypto.randomUUID();
    const setor = Setor.fromString(input.sector);
    const uploadados: ArquivoUploadResultadoDTO[] = [];
    const falhas: ArquivoUploadFalhaDTO[] = [];
    const entidadesParaSalvar: DocumentoFiscal[] = [];

    // -------------------------------------------------------------------------
    // Etapa 1: Processar arquivos em paralelo controlado
    // -------------------------------------------------------------------------
    for (let i = 0; i < input.arquivos.length; i += CONCORRENCIA_UPLOAD) {
      const loteAtual = input.arquivos.slice(i, i + CONCORRENCIA_UPLOAD);

      const resultados = await Promise.allSettled(
        loteAtual.map((arquivo) =>
          this.processarArquivo(arquivo, input.clienteId, input.contadorId, setor),
        ),
      );

      for (let j = 0; j < resultados.length; j++) {
        const resultado = resultados[j];
        const arquivo = loteAtual[j];

        if (resultado.status === 'fulfilled') {
          uploadados.push(resultado.value.dto);
          entidadesParaSalvar.push(resultado.value.entidade);
        } else {
          falhas.push({
            fileName: arquivo.fileName,
            motivo:
              resultado.reason instanceof Error
                ? resultado.reason.message
                : 'Erro inesperado durante o processamento do arquivo.',
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // Etapa 2: Persistência em batch (transação única — tudo ou nada)
    // -------------------------------------------------------------------------
    if (entidadesParaSalvar.length > 0) {
      await this.documentoRepository.salvarLote(entidadesParaSalvar);
    }

    // -------------------------------------------------------------------------
    // Etapa 3: Audit log (fire-and-forget — falha não aborta a operação)
    // -------------------------------------------------------------------------
    try {
      const auditLog = AuditLog.criar({
        id: crypto.randomUUID(),
        userId: input.contadorId,
        documentId: null,
        actionType: 'UPLOAD_BATCH',
        resourceType: 'DOCUMENT',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent ?? null,
        detailsJson: {
          loteId,
          sector: setor.tipo,
          clienteId: input.clienteId,
          totalEnviados: input.arquivos.length,
          totalUploadados: uploadados.length,
          totalFalhas: falhas.length,
          falhasDetalhes: falhas.map((f) => ({ fileName: f.fileName, motivo: f.motivo })),
        },
      });
      await this.auditLogRepository.salvar(auditLog);
    } catch {
      // Log de auditoria é best-effort. A operação principal já foi concluída.
      // Em produção, este catch seria substituído por um logger estruturado (Pino).
    }

    // -------------------------------------------------------------------------
    // Etapa 4: Publicar evento de domínio (APÓS persistência bem-sucedida)
    // -------------------------------------------------------------------------
    const evento = new NovoDocumentoUploadEvent({
      loteId,
      clienteId: input.clienteId,
      contadorId: input.contadorId,
      sector: setor.tipo,
      uploadados: uploadados.map((u) => ({
        documentoId: u.documentoId,
        fileName: u.fileName,
        storagePath: u.storagePath,
        fileHash: u.fileHash,
      })),
      falhas: falhas.map((f) => ({
        fileName: f.fileName,
        motivo: f.motivo,
      })),
    });
    await this.eventDispatcher.dispatch(evento);

    return { loteId, totalArquivos: input.arquivos.length, uploadados, falhas };
  }

  // ---------------------------------------------------------------------------
  // Processamento individual de arquivo (chamado em paralelo)
  // ---------------------------------------------------------------------------

  private async processarArquivo(
    arquivo: ArquivoUploadInputDTO,
    clienteId: string,
    contadorId: string,
    setor: Setor,
  ): Promise<{ dto: ArquivoUploadResultadoDTO; entidade: DocumentoFiscal }> {

    // 1. Factory Method: valida e determina o tipo do arquivo pelo MIME
    const fileType = MIME_PARA_FILETYPE[arquivo.mimeType];
    if (!fileType) {
      throw new DomainException(
        `Tipo de arquivo não suportado: "${arquivo.mimeType}". ` +
          `Formatos aceitos: PDF, XML, XLSX, XLS, DOCX, DOC, CSV, OFX, ODS.`,
      );
    }

    // 2. Valida o tamanho (defesa em profundidade — o controller também valida)
    if (arquivo.fileSizeBytes > MAX_TAMANHO_ARQUIVO_BYTES) {
      throw new DomainException(
        `Arquivo "${arquivo.fileName}" excede o limite de 10 MB ` +
          `(${(arquivo.fileSizeBytes / 1_048_576).toFixed(2)} MB recebido).`,
      );
    }

    // 3. Valida consistência do tamanho declarado vs conteúdo real
    if (arquivo.conteudo.byteLength !== arquivo.fileSizeBytes) {
      throw new DomainException(
        `Inconsistência no tamanho de "${arquivo.fileName}": ` +
          `declarado ${arquivo.fileSizeBytes} bytes, recebido ${arquivo.conteudo.byteLength} bytes.`,
      );
    }

    // 3.5. Normaliza PDF para garantir compatibilidade com Firefox PDF.js
    const conteudoFinal = arquivo.mimeType === 'application/pdf'
      ? await normalizarPdfBuffer(arquivo.conteudo)
      : arquivo.conteudo;

    // 4. Calcula SHA-256 do conteúdo normalizado (integridade + deduplicação)
    const fileHash = createHash('sha256').update(conteudoFinal).digest('hex');

    // 5. Verifica duplicidade (mesmo arquivo + mesmo cliente)
    const duplicado = await this.documentoRepository.hashJaExiste(fileHash, clienteId);
    if (duplicado) {
      throw new DomainException(
        `Arquivo "${arquivo.fileName}" já existe para este cliente (hash duplicado). ` +
          `Use o documento já cadastrado ou renomeie se o conteúdo for diferente.`,
      );
    }

    // 6. Gera o storage path seguindo a convenção arquitetural:
    //    /{clientId}/{sector}/{YYYY-MM}/{fileHash}_{nomeArquivoSanitizado}
    const storagePath = this.gerarStoragePath(
      clienteId,
      setor.tipo,
      fileHash,
      arquivo.fileName,
      arquivo.competencia,
    );

    // 7. Faz upload binário ao MinIO via abstração IStorageService
    await this.storageService.upload(storagePath, conteudoFinal, arquivo.mimeType);

    // 8. Instancia a Entidade Rica (nunca anêmica — encapsula invariantes)
    const documentoId = crypto.randomUUID();
    const entidade = DocumentoFiscal.criar({
      id: documentoId,
      clientId: clienteId,
      uploadedById: contadorId,
      sector: setor,
      fileName: arquivo.fileName,
      storagePath,
      fileType,
      fileSizeBytes: conteudoFinal.byteLength,
      fileHash,
      competencia: arquivo.competencia ?? null,
      metadataJson: arquivo.metadataExtra ?? {},
    });

    return {
      dto: { documentoId, fileName: arquivo.fileName, fileHash, storagePath },
      entidade,
    };
  }

  // ---------------------------------------------------------------------------
  // Métodos auxiliares privados
  // ---------------------------------------------------------------------------

  /**
   * Valida os parâmetros globais do lote antes de processar qualquer arquivo.
   * Falha rápida (fast fail) — evita processar parcialmente um input inválido.
   */
  private validarInputGlobal(input: ProcessarUploadLoteInputDTO): void {
    if (!input.clienteId?.trim()) {
      throw new DomainException('clienteId é obrigatório no upload em lote.');
    }
    if (!input.contadorId?.trim()) {
      throw new DomainException('contadorId é obrigatório no upload em lote.');
    }
    if (!input.ipAddress?.trim()) {
      throw new DomainException('ipAddress é obrigatório para rastreabilidade do upload.');
    }
    if (!input.arquivos || input.arquivos.length === 0) {
      throw new DomainException('O lote deve conter pelo menos um arquivo.');
    }
    if (input.arquivos.length > MAX_ARQUIVOS_POR_LOTE) {
      throw new DomainException(
        `O lote excede o limite de ${MAX_ARQUIVOS_POR_LOTE} arquivos. ` +
          `Recebido: ${input.arquivos.length} arquivos.`,
      );
    }
    if (!input.sector) {
      throw new DomainException('O setor é obrigatório (FISCAL, PESSOAL ou CONTABIL).');
    }
  }

  /**
   * Gera o caminho de armazenamento no MinIO com UUID para privacidade (LGPD).
   * Formato: `{clientId}/{sector}/{YYYY-MM}/{UUID}.{ext}`
   *
   * LGPD: O nome original do arquivo NÃO é exposto no storage path.
   * O nome original é preservado apenas no banco de dados (campo fileName).
   */
  private gerarStoragePath(
    clienteId: string,
    sector: string,
    _fileHash: string,
    fileName: string,
    competencia?: Date,
  ): string {
    const data = competencia ?? new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const anoMes = `${ano}-${mes}`;
    const ext = extrairExtensao(fileName);
    const uuid = crypto.randomUUID();
    return `${clienteId}/${sector}/${anoMes}/${uuid}${ext}`;
  }
}

// ---------------------------------------------------------------------------
// Função auxiliar de segurança (fora da classe — sem acesso a `this`)
// ---------------------------------------------------------------------------

/**
/**
 * Extrai a extensão do nome do arquivo de forma segura.
 * Retorna string vazia se não houver extensão.
 */
function extrairExtensao(nome: string): string {
  const base = nome.split('/').pop()?.split('\\').pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  const ext = base.slice(dot).toLowerCase().replace(/[^\w.]/g, '');
  return ext.length <= 10 ? ext : '';
}
