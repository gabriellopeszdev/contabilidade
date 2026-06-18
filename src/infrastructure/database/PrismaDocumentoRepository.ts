import type { PrismaClient, Prisma } from '@prisma/client';
// Prisma gera o tipo do modelo com o mesmo nome da tabela — para evitar
// colisão com a nossa Entidade de Domínio, importamos com alias.
import type { DocumentoFiscal as PrismaDocRow } from '@prisma/client';

import {
  DocumentoFiscal,
  type DocumentoFiscalProps,
  type FileType,
} from '../../domain/entities/DocumentoFiscal';
import type { IDocumentoRepository, FiltroDocumento } from '../../domain/ports/IDocumentoRepository';
import { Setor } from '../../domain/value-objects/Setor';
import type { PaginacaoParams, ResultadoPaginado } from '../../shared/PaginationHelper';
import { PaginacaoHelper } from '../../shared/PaginationHelper';

// =============================================================================
// PrismaDocumentoRepository
//
// Adaptador concreto que implementa IDocumentoRepository usando o Prisma ORM.
// Responsabilidades:
//   1. Traduzir chamadas do domínio em queries Prisma (Command side)
//   2. Mapear o modelo Prisma de volta para a Entidade Rica do domínio (Query side)
//
// REGRA DE DEPENDÊNCIA: este arquivo conhece o Prisma.
//                       O domínio NUNCA importa daqui.
// =============================================================================

export class PrismaDocumentoRepository implements IDocumentoRepository {
  // O PrismaClient é injetado via construtor (Dependency Injection).
  // Isso permite trocar por um mock nos testes ou por um client transacional
  // quando chamado de dentro de uma $transaction.
  constructor(private readonly prisma: PrismaClient) {}

  // ---------------------------------------------------------------------------
  // salvar — persiste um DocumentoFiscal novo
  // ---------------------------------------------------------------------------

  async salvar(documento: DocumentoFiscal): Promise<void> {
    await this.prisma.documentoFiscal.create({
      data: PrismaDocumentoRepository.toCreateInput(documento),
    });
  }

  // ---------------------------------------------------------------------------
  // salvarLote — persiste até 50 documentos em uma única transação atômica
  // ---------------------------------------------------------------------------

  async salvarLote(documentos: DocumentoFiscal[]): Promise<void> {
    if (documentos.length === 0) return;
    if (documentos.length > 50) {
      throw new Error(
        `salvarLote: limite de 50 documentos por lote excedido (recebidos: ${documentos.length}).`,
      );
    }

    // Cada createMany individual dentro de $transaction garante rollback total
    // se qualquer um falhar. Usamos createMany para performance (batch insert).
    await this.prisma.$transaction(async (tx) => {
      await tx.documentoFiscal.createMany({
        data: documentos.map(PrismaDocumentoRepository.toCreateManyInput),
        // skipDuplicates: false (padrão) — deixamos estourar o erro único
        // para que o use case trate duplicatas via hashJaExiste() antes
      });
    });
  }

  // ---------------------------------------------------------------------------
  // buscarPorId — retorna null se não encontrado ou soft-deleted
  // ---------------------------------------------------------------------------

  async buscarPorId(id: string): Promise<DocumentoFiscal | null> {
    const row = await this.prisma.documentoFiscal.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!row) return null;
    return PrismaDocumentoRepository.toDomain(row);
  }

  // ---------------------------------------------------------------------------
  // listarPorCliente — filtros opcionais + paginação
  // ---------------------------------------------------------------------------

  async listarPorCliente(
    clienteId: string,
    filtros?: FiltroDocumento,
    paginacao?: PaginacaoParams,
  ): Promise<ResultadoPaginado<DocumentoFiscal>> {
    const params = paginacao ?? PaginacaoHelper.padrao();
    PaginacaoHelper.validar(params);

    const where = PrismaDocumentoRepository.buildWhereClause(clienteId, filtros);
    const skip  = PaginacaoHelper.calcularOffset(params);
    const take  = params.perPage;

    // count + findMany em paralelo para minimizar round-trips ao banco
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.documentoFiscal.count({ where }),
      this.prisma.documentoFiscal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    const items = rows.map(PrismaDocumentoRepository.toDomain);
    return PaginacaoHelper.construir(items, total, params);
  }

  // ---------------------------------------------------------------------------
  // hashJaExiste — deduplicação rápida via índice (fileHash, clientId)
  // ---------------------------------------------------------------------------

  async hashJaExiste(fileHash: string, clienteId: string): Promise<boolean> {
    const count = await this.prisma.documentoFiscal.count({
      where: {
        fileHash,
        clientId: clienteId,
        // Incluímos soft-deleted: um arquivo deletado ainda ocupa espaço no
        // MinIO até o offboarding. Tratamos como duplicata para evitar re-upload.
        // Se o comportamento desejado for diferente, remova esta linha.
        // deletedAt: null,
      },
    });
    return count > 0;
  }

  // ---------------------------------------------------------------------------
  // atualizar — persiste mudanças de estado (readStatus, readAt) via upsert
  // ---------------------------------------------------------------------------

  async atualizar(documento: DocumentoFiscal): Promise<void> {
    await this.prisma.documentoFiscal.update({
      where: { id: documento.id },
      data: {
        readStatus: documento.readStatus,
        readAt:     documento.readAt,
        // updatedAt é gerenciado automaticamente pelo Prisma (@updatedAt)
      },
    });
  }

  // ---------------------------------------------------------------------------
  // deletar — soft delete: marca deletedAt sem remover a linha ou o arquivo
  // ---------------------------------------------------------------------------

  async deletar(id: string): Promise<void> {
    await this.prisma.documentoFiscal.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // listarTodosDoClienteParaOffboarding — ignora soft delete intencionalmente
  // ---------------------------------------------------------------------------

  async listarTodosDoClienteParaOffboarding(clienteId: string): Promise<DocumentoFiscal[]> {
    const rows = await this.prisma.documentoFiscal.findMany({
      where: { clientId: clienteId },
      // Inclui deletados — o use case de offboarding precisa de todos para
      // fazer a remoção física no MinIO e o relatório LGPD
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(PrismaDocumentoRepository.toDomain);
  }

  // ===========================================================================
  // DATA MAPPER — Métodos estáticos privados
  //
  // Separação clara de responsabilidades:
  //   toDomain()        → Prisma Row ──► Entidade Rica do Domínio
  //   toCreateInput()   → Entidade Rica do Domínio ──► Prisma CreateInput
  //
  // Por que estático? O mapper não depende de estado da instância (sem `this`).
  // Por que privado? Nenhum outro módulo deve conhecer o formato Prisma.
  // ===========================================================================

  /**
   * Converte uma linha bruta do Prisma na Entidade Rica DocumentoFiscal.
   *
   * Pontos-chave do mapeamento:
   *
   *   1. fileSizeBytes (bigint → number)
   *      O Prisma mapeia BIGINT do Postgres para o tipo primitivo `bigint` do
   *      JavaScript. A entidade de domínio usa `number`. A conversão é segura
   *      aqui porque arquivos fiscais têm no máximo poucos MB — muito abaixo
   *      do Number.MAX_SAFE_INTEGER (≈ 9 PB).
   *
   *   2. metadataJson (Prisma.JsonValue → Record<string, unknown>)
   *      O Prisma tipifica campos Json como `Prisma.JsonValue` (union ampla).
   *      Fazemos o cast explícito pois sabemos que gravamos apenas objetos.
   *      O banco nunca retornará null aqui (default "{}").
   *
   *   3. sector (string/enum → Setor VO)
   *      O Prisma retorna o valor do enum como string TypeScript.
   *      Reconstruímos o Value Object rico via Setor.fromString().
   *
   *   4. DocumentoFiscal.reconstituir()
   *      Usamos o factory de reconstituição — não o de criação — para:
   *        - Não emitir eventos de domínio (reconstituição é neutra)
   *        - Preservar o readAt, readStatus e createdAt originais do banco
   *        - Passar pela validarProps() sem redefinir timestamps
   */
  private static toDomain(row: PrismaDocRow): DocumentoFiscal {
    const props: DocumentoFiscalProps = {
      id:            row.id,
      clientId:      row.clientId,
      uploadedById:  row.uploadedById,
      // VO rico com metadados de retenção legal, descrição, etc.
      sector:        Setor.fromString(row.sector ?? 'TODOS'),
      fileName:      row.fileName,
      storagePath:   row.storagePath,
      // O enum Prisma é string-compatível com o union type do domínio
      fileType:      row.fileType as FileType,
      // bigint → number: seguro para arquivos fiscais (tipicamente < 10 MB)
      fileSizeBytes: Number(row.fileSizeBytes),
      fileHash:      row.fileHash,
      readStatus:    row.readStatus,
      readAt:        row.readAt,
      competencia:   row.competencia,
      // cast seguro: gravamos apenas objetos (nunca arrays ou primitivos)
      metadataJson:  (row.metadataJson ?? {}) as Record<string, unknown>,
      createdAt:     row.createdAt,
    };

    // reconstituir() usa o construtor privado sem emitir eventos de domínio.
    // É a única forma correta de remontar a entidade vinda do banco.
    return DocumentoFiscal.reconstituir(props);
  }

  /**
   * Converte a Entidade Rica em um objeto compatível com Prisma.DocumentoFiscalCreateInput.
   *
   * Pontos-chave:
   *
   *   1. fileSizeBytes (number → bigint)
   *      Sentido inverso do toDomain. BigInt() é necessário porque o Prisma
   *      exige `bigint` para campos mapeados como BIGINT no Postgres.
   *
   *   2. sector (Setor VO → string do enum Prisma)
   *      O Prisma aceita o valor string literal do enum diretamente.
   *      sector.tipo retorna SetorTipo ('FISCAL' | 'PESSOAL' | 'CONTABIL').
   *
   *   3. Não incluímos updatedAt: o Prisma gerencia via @updatedAt.
   *   4. Não incluímos deletedAt: novo documento nunca está deletado.
   */
  /**
   * Para `prisma.create()` (um documento): usa relação aninhada `cliente: { connect }`.
   * O Prisma exige esta forma quando se passa o relacionamento via objeto.
   */
  private static toCreateInput(
    doc: DocumentoFiscal,
  ): Prisma.DocumentoFiscalCreateInput {
    return {
      id:           doc.id,
      cliente:      { connect: { id: doc.clientId } },
      uploadedById: doc.uploadedById,
      sector:       doc.sector.tipo,
      fileName:     doc.fileName,
      storagePath:  doc.storagePath,
      fileType:     doc.fileType,
      fileSizeBytes: BigInt(doc.fileSizeBytes),
      fileHash:     doc.fileHash,
      readStatus:   doc.readStatus,
      readAt:       doc.readAt,
      competencia:  doc.competencia,
      metadataJson: doc.metadataJson as Prisma.InputJsonValue,
      createdAt:    doc.createdAt,
    };
  }

  /**
   * Para `prisma.createMany()` (lote): usa o campo escalar `clientId` diretamente.
   * `createMany` não suporta escrita aninhada (`cliente: { connect }`), apenas
   * campos escalares. Por isso existe este método separado.
   */
  private static toCreateManyInput(
    doc: DocumentoFiscal,
  ): Prisma.DocumentoFiscalCreateManyInput {
    return {
      id:           doc.id,
      clientId:     doc.clientId,
      uploadedById: doc.uploadedById,
      sector:       doc.sector.tipo,
      fileName:     doc.fileName,
      storagePath:  doc.storagePath,
      fileType:     doc.fileType,
      fileSizeBytes: BigInt(doc.fileSizeBytes),
      fileHash:     doc.fileHash,
      readStatus:   doc.readStatus,
      readAt:       doc.readAt,
      competencia:  doc.competencia,
      metadataJson: doc.metadataJson as Prisma.InputJsonValue,
      createdAt:    doc.createdAt,
    };
  }

  // ---------------------------------------------------------------------------
  // buildWhereClause — constrói o filtro Prisma a partir dos FiltroDocumento
  // ---------------------------------------------------------------------------

  private static buildWhereClause(
    clienteId: string,
    filtros?: FiltroDocumento,
  ): Prisma.DocumentoFiscalWhereInput {
    const where: Prisma.DocumentoFiscalWhereInput = {
      clientId:  clienteId,
      // Soft delete: nunca retornar registros excluídos na listagem normal
      deletedAt: null,
    };

    if (!filtros) return where;

    if (filtros.setores && filtros.setores.length > 0) {
      where.sector = { in: filtros.setores };
    } else if (filtros.sector) {
      where.sector = filtros.sector;
    }

    if (filtros.fileType) {
      where.fileType = filtros.fileType;
    }

    if (filtros.readStatus !== undefined) {
      where.readStatus = filtros.readStatus;
    }

    if (filtros.competenciaInicio || filtros.competenciaFim) {
      where.competencia = {
        ...(filtros.competenciaInicio && { gte: filtros.competenciaInicio }),
        ...(filtros.competenciaFim    && { lte: filtros.competenciaFim }),
      };
    }

    if (filtros.termo) {
      // Busca parcial por nome de arquivo (case-insensitive)
      // Para full-text search avançado, migrar para tsvector + índice GIN
      where.fileName = {
        contains: filtros.termo,
        mode:     'insensitive',
      };
    }

    if (filtros.uploadedById) {
      where.uploadedById = filtros.uploadedById;
    }
    if (filtros.uploadedByIds && filtros.uploadedByIds.length > 0) {
      where.uploadedById = { in: filtros.uploadedByIds };
    }
    if (filtros.uploadedByNotIds && filtros.uploadedByNotIds.length > 0) {
      where.uploadedById = { notIn: filtros.uploadedByNotIds };
    }

    return where;
  }
}
