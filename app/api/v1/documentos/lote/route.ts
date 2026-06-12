import { NextRequest, NextResponse } from 'next/server';

import { withAuth }                  from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { processarUploadLoteUseCase } from '../../../../../src/infrastructure/di/Container';
import { prisma }                     from '../../../../../src/infrastructure/di/Container';
import { queueProducer }              from '../../../../../src/infrastructure/di/Container';
import { emailService }               from '../../../../../src/infrastructure/di/Container';
import { logger }                     from '../../../../../src/utils/logger';
import { parsearFormDataUploadLote } from '../../../../../src/infrastructure/http/validators/UploadLoteSchema';
import { DomainException }           from '../../../../../src/domain/exceptions/DomainException';
import type { ProcessarUploadLoteOutputDTO } from '../../../../../src/application/dtos/UploadLoteDTO';

// =============================================================================
// Configuração do runtime Next.js
//
// 'nodejs' é obrigatório porque:
//   1. Buffer (Node.js built-in) — necessário para conteúdo binário dos arquivos
//   2. MinIO SDK — usa módulos Node.js internamente (http, streams, crypto)
//   3. ioredis — conexão TCP ao Redis via net module do Node.js
//   4. Prisma Client — acesso ao banco via pg (driver Node.js)
//
// 'force-dynamic' impede que o Next.js gere uma versão estática desta rota
// durante o build (ela é intrinsecamente dinâmica — depende de auth + FormData).
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Helpers privados
// =============================================================================

/**
 * Extrai o IP real do cliente, respeitando o proxy reverso nginx self-hosted.
 *
 * Ordem de prioridade:
 *   1. X-Real-IP     → setado pelo nginx: `proxy_set_header X-Real-IP $remote_addr`
 *   2. X-Forwarded-For → padrão HTTP para cadeia de proxies (primeiro = cliente)
 *   3. Fallback 127.0.0.1 → ambiente de desenvolvimento sem proxy
 */
function extrairIp(request: NextRequest): string {
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp?.trim()) return xRealIp.trim();

  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor?.trim()) {
    return xForwardedFor.split(',')[0].trim();
  }

  return '127.0.0.1';
}

/**
 * Mapeia o output do use case para o status HTTP correto.
 *
 * Railway-Oriented HTTP:
 *   201 Created       → todos os arquivos foram persistidos com sucesso
 *   207 Multi-Status  → sucesso parcial (alguns falharam, outros não)
 *   422 Unprocessable → todos os arquivos falharam (input válido, resultado vazio)
 *
 * RFC 4918 define 207 Multi-Status para operações em que diferentes partes
 * de uma requisição podem ter resultados diferentes — exatamente o nosso caso.
 */
function resolverStatusCode(output: ProcessarUploadLoteOutputDTO): 201 | 207 | 422 {
  if (output.falhas.length === 0)     return 201; // tudo certo
  if (output.uploadados.length > 0)  return 207; // parcial
  return 422;                                      // tudo falhou
}

// =============================================================================
// POST /api/v1/documentos/lote
//
// Recebe um FormData com:
//   clienteId:   string (UUID v4, obrigatório)
//   sector:      "FISCAL" | "PESSOAL" | "CONTABIL" (obrigatório)
//   loteId:      string (UUID v4, opcional — para idempotência em retries)
//   competencia: string "YYYY-MM-DD" (opcional — mês de competência fiscal)
//   arquivos:    File[] (obrigatório, 1–50 arquivos, máx 10 MB cada, .xml ou .pdf)
//
// Headers obrigatórios:
//   Authorization: Bearer <jwt>
//   Content-Type:  multipart/form-data (setado automaticamente pelo browser)
//
// Respostas:
//   201 Created             → { ok: true,  loteId, totalUploadados, uploadados[], falhas: [] }
//   207 Multi-Status        → { ok: false, loteId, totalUploadados, uploadados[], falhas[] }
//   400 Bad Request         → { ok: false, error, erros: string[] }
//   401 Unauthorized        → { ok: false, error }
//   403 Forbidden           → { ok: false, error }
//   422 Unprocessable Entity→ { ok: false, loteId, totalUploadados: 0, uploadados: [], falhas[] }
//   500 Internal Server Error→ { ok: false, error }
// =============================================================================

export const POST = withAuth(async (request, _ctx, auth): Promise<NextResponse> => {

  const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
  const ipAddress  = extrairIp(request);
  const userAgent  = request.headers.get('user-agent') ?? undefined;

  // -------------------------------------------------------------------------
  // Etapa 2: Parse do FormData
  // Feito em bloco separado para tratar multipart malformado
  // -------------------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        ok:    false,
        error: 'Corpo da requisição inválido.',
        detalhe: 'Esperado: multipart/form-data com campo "arquivos".',
      },
      { status: 400 },
    );
  }

  // -------------------------------------------------------------------------
  // Etapa 3: Validação Zero-Trust (Zod + regras de segurança)
  //   - UUIDs válidos (clienteId, loteId)
  //   - Setor válido
  //   - Nome de arquivo: sem path traversal, sem null bytes, extensão permitida
  //   - MIME type: somente application/xml, text/xml, application/pdf
  //   - Tamanho: máximo 10 MB por arquivo, máximo 50 arquivos por lote
  //
  // Se qualquer validação falhar, retorna 400 com todos os erros coletados.
  // Leitura do conteúdo binário é ADIADA para após esta etapa.
  // -------------------------------------------------------------------------
  const parseResult = await parsearFormDataUploadLote(
    formData,
    contadorId,
    ipAddress,
    userAgent,
  );

  if (!parseResult.ok) {
    return NextResponse.json(
      {
        ok:    false,
        error: 'Validação falhou. Corrija os erros abaixo e tente novamente.',
        erros: parseResult.erros,
      },
      { status: 400 },
    );
  }

  // -------------------------------------------------------------------------
  // Etapa 4: Validar que o cliente pertence ao contador logado
  // (IDOR protection — impede envio de documentos para cliente alheio)
  // -------------------------------------------------------------------------
  const vinculo = await prisma.contadorCliente.findUnique({
    where: {
      contadorId_clienteId: {
        contadorId,
        clienteId: parseResult.dto.clienteId,
      },
    },
    include: {
      cliente: { select: { email: true, name: true, notifEmailNovoDoc: true } },
    },
  });

  if (!vinculo) {
    return NextResponse.json(
      {
        ok:    false,
        error: 'Cliente não encontrado ou não vinculado à sua conta.',
      },
      { status: 403 },
    );
  }

  // -------------------------------------------------------------------------
  // Etapa 4.1: Validar que o funcionário tem acesso ao setor selecionado
  // -------------------------------------------------------------------------
  if (auth.role === 'EMPLOYEE') {
    const setoresPermitidos = auth.setores as string[] | undefined;
    const temTodos = setoresPermitidos?.includes('TODOS');
    if (!temTodos && setoresPermitidos?.length) {
      const setorEscolhido = parseResult.dto.sector;
      if (!setoresPermitidos.includes(setorEscolhido)) {
        return NextResponse.json(
          {
            ok:    false,
            error: `Você não tem permissão para enviar documentos no setor ${setorEscolhido}.`,
          },
          { status: 403 },
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Etapa 5: Execução do Use Case
  //   - Verifica duplicatas (hash SHA-256 + clienteId)
  //   - Faz upload ao MinIO (paralelo controlado, máx 5 concurrent)
  //   - Persiste entidades no PostgreSQL (transação única)
  //   - Grava AuditLog (fire-and-forget)
  //   - Despacha NovoDocumentoUploadEvent → Redis Pub/Sub → WebSocket
  // -------------------------------------------------------------------------
  let output: ProcessarUploadLoteOutputDTO;
  try {
    output = await processarUploadLoteUseCase.executar(parseResult.dto);
  } catch (err) {
    if (err instanceof DomainException) {
      // Erro de negócio explícito: lote excede limite, setor inválido, etc.
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 422 },
      );
    }

    // Erro de infraestrutura: DB offline, MinIO timeout, Redis unavailable
    logger.error('[POST /documentos/lote] Erro inesperado', err instanceof Error ? err : undefined);
    return NextResponse.json(
      {
        ok:    false,
        error: 'Erro interno do servidor. A equipe foi notificada. Tente novamente em instantes.',
      },
      { status: 500 },
    );
  }

  // Fire-and-forget: enqueue XML parse jobs for uploaded NF-e files
  for (const uploadado of output.uploadados) {
    const arquivo = parseResult.dto.arquivos.find((a) => a.fileName === uploadado.fileName);
    if (arquivo && (arquivo.mimeType === 'application/xml' || arquivo.mimeType === 'text/xml')) {
      queueProducer.add('PARSEAR_XML_NFE', {
        tipo: 'PARSEAR_XML_NFE',
        payload: { documentoId: uploadado.documentoId, storagePath: uploadado.storagePath },
      }).catch(() => {/* fire-and-forget */});
    }
  }

  // Create version 1 for each newly uploaded document (fire-and-forget)
  if (output.uploadados.length > 0) {
    prisma.documentoVersao.createMany({
      data: output.uploadados.map((u) => ({
        documentoId:   u.documentoId,
        versao:        1,
        storagePath:   u.storagePath,
        fileHash:      u.fileHash,
        fileSizeBytes: BigInt(parseResult.dto.arquivos.find((a) => a.fileName === u.fileName)?.fileSizeBytes ?? 0),
        uploadedById:  parseResult.dto.contadorId,
      })),
      skipDuplicates: true,
    }).catch(() => {/* non-critical */});
  }

  // Fire-and-forget: notificar cliente por email para cada documento enviado
  if (output.uploadados.length > 0 && vinculo.cliente.notifEmailNovoDoc) {
    for (const uploadado of output.uploadados) {
      emailService
        .enviarNovoDocumentoDisponivel({
          emailCliente: vinculo.cliente.email,
          nomeCliente:  vinculo.cliente.name,
          nomeArquivo:  uploadado.fileName,
          setor:        parseResult.dto.sector,
          urlPortal:    process.env.NEXT_PUBLIC_APP_URL ?? '',
        })
        .catch((err) => logger.error('[lote] falha ao enviar email novo doc', err instanceof Error ? err : undefined));
    }
  }

  // -------------------------------------------------------------------------
  // Etapa 6: Mapeamento Railway-Oriented → Status HTTP
  // -------------------------------------------------------------------------
  const status = resolverStatusCode(output);

  return NextResponse.json(
    {
      ok:              status === 201,
      loteId:          output.loteId,
      totalArquivos:   output.totalArquivos,
      totalUploadados: output.uploadados.length,
      totalFalhas:     output.falhas.length,
      uploadados:      output.uploadados,
      falhas:          output.falhas,
    },
    { status },
  );
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
