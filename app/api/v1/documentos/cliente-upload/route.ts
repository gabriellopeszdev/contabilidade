import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

import { SetorTipo }       from '@prisma/client';
import { withAuth }        from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService, emailService } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';
import { normalizarPdfBuffer } from '../../../../../src/infrastructure/pdf/normalizarPdf';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Constantes de validação
// =============================================================================

const TIPOS_ACEITOS: Record<string, string> = {
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
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const CATEGORIA_SETOR_MAP: Record<string, SetorTipo> = {
  xml:      SetorTipo.FISCAL,
  extratos: SetorTipo.CONTABIL,
  despesas: SetorTipo.CONTABIL,
  impostos: SetorTipo.CONTABIL,
  folha:    SetorTipo.PESSOAL,
};

// =============================================================================
// POST /api/v1/documentos/cliente-upload
//
// Upload de documento avulso feito pelo CLIENTE.
//
// O cliente seleciona um arquivo — o setor é definido pelo contador depois.
// O sistema:
//   1. Valida o arquivo (tipo, tamanho)
//   2. Calcula SHA-256 para deduplicação
//   3. Salva o binário no MinIO
//   4. Cria o registro DocumentoFiscal (sector = null, a categorizar)
//   5. Cria uma TarefaKanban (PENDING) direcionada ao contador responsável
//   6. Registra AuditLog
//
// FormData esperado:
//   arquivo  → File (PDF, XML, XLSX, XLS, DOCX, DOC, CSV, OFX, ODS — máx 10 MB)
//
// Respostas:
//   201 → { documento, tarefa }
//   400 → Validação falhou
//   409 → Documento duplicado (mesmo hash + cliente)
//   500 → Erro interno
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  try {
    // ------------------------------------------------------------------
    // 1. Extrair FormData
    // ------------------------------------------------------------------
    const formData    = await req.formData();
    const arquivo     = formData.get('arquivo') as File | null;
    const categoriaId = formData.get('categoriaId') as string | null;
    const sector      = categoriaId ? (CATEGORIA_SETOR_MAP[categoriaId] ?? null) : null;

    if (!arquivo || !(arquivo instanceof File) || arquivo.size === 0) {
      return NextResponse.json(
        { message: 'O campo "arquivo" é obrigatório e deve conter um arquivo válido.' },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------------
    // 2. Validar tipo e tamanho
    // ------------------------------------------------------------------
    const fileType = TIPOS_ACEITOS[arquivo.type];
    if (!fileType) {
      return NextResponse.json(
        { message: 'Tipo de arquivo não permitido. Formatos aceitos: PDF, XML, XLSX, XLS, DOCX, DOC, CSV, OFX, ODS.' },
        { status: 400 },
      );
    }

    if (arquivo.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: `Arquivo excede o limite de ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------------
    // 3. Ler conteúdo, normalizar PDF e calcular SHA-256
    // ------------------------------------------------------------------
    const bufferOriginal = Buffer.from(await arquivo.arrayBuffer());
    const buffer = arquivo.type === 'application/pdf'
      ? await normalizarPdfBuffer(bufferOriginal)
      : bufferOriginal;
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    // Deduplicação: mesmo arquivo para o mesmo cliente
    const duplicado = await prisma.documentoFiscal.findFirst({
      where: {
        clientId:  auth.sub,
        fileHash,
        deletedAt: null,
      },
      select: { id: true, fileName: true },
    });

    if (duplicado) {
      return NextResponse.json(
        {
          message: `Este arquivo já foi enviado anteriormente (${duplicado.fileName}).`,
          documentoExistenteId: duplicado.id,
        },
        { status: 409 },
      );
    }

    // ------------------------------------------------------------------
    // 4. Upload para MinIO
    // ------------------------------------------------------------------
    const timestamp   = Date.now();
    const safeName    = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `clientes/${auth.sub}/pendente/${timestamp}_${safeName}`;

    await storageService.upload(storagePath, buffer, arquivo.type);

    // ------------------------------------------------------------------
    // 5. Buscar o contador responsável (primeiro vínculo ativo)
    // ------------------------------------------------------------------
    const vinculo = await prisma.contadorCliente.findFirst({
      where:   { clienteId: auth.sub },
      include: {
        contador: { select: { id: true, email: true, name: true, notifEmailNovoDoc: true } },
      },
    });

    // ------------------------------------------------------------------
    // 6. Criar DocumentoFiscal + TarefaKanban em transação
    // ------------------------------------------------------------------
    const resultado = await prisma.$transaction(async (tx) => {
      const documento = await tx.documentoFiscal.create({
        data: {
          clientId:      auth.sub,
          uploadedById:  auth.sub,
          fileName:      arquivo.name,
          storagePath,
          fileType:      fileType as 'PDF' | 'XML' | 'XLSX' | 'XLS' | 'DOCX' | 'DOC' | 'CSV' | 'OFX' | 'ODS',
          fileSizeBytes: BigInt(buffer.byteLength),
          fileHash,
          ...(sector ? { sector } : {}),
        },
      });

      const tarefa = await tx.tarefaKanban.create({
        data: {
          clientId:     auth.sub,
          assignedTo:   vinculo?.contador?.id ?? null,
          documentId:   documento.id,
          title:        arquivo.name,
          description:  sector
            ? `Documento enviado pelo cliente — setor: ${sector}`
            : 'Documento enviado pelo cliente — aguardando categorização',
          currentState: 'PENDING',
          priority:     'MEDIUM',
          position:     0,
          ...(sector ? { sector } : {}),
        },
      });

      // AuditLog
      await tx.auditLog.create({
        data: {
          documentId:   documento.id,
          userId:       auth.sub,
          actionType:   'UPLOAD_BATCH',
          resourceType: 'DOCUMENT',
          detailsJson: {
            fileName:    arquivo.name,
            fileType,
            fileSizeBytes: arquivo.size,
            origin:      'CLIENT_UPLOAD',
          },
          ipAddress:  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                       ?? req.headers.get('x-real-ip')
                       ?? '0.0.0.0',
          userAgent:  req.headers.get('user-agent') ?? null,
        },
      });

      return { documento, tarefa };
    });

    // ------------------------------------------------------------------
    // 7. Notifica o contador por e-mail (fire-and-forget)
    // ------------------------------------------------------------------
    if (vinculo?.contador?.notifEmailNovoDoc) {
      const nomeCliente = auth.nome ?? 'Um cliente';
      emailService
        .enviarNovoDocumentoContador({
          emailContador: vinculo.contador.email,
          nomeContador:  vinculo.contador.name,
          nomeCliente,
          nomeArquivo:   arquivo.name,
          setor:         sector ?? 'A categorizar',
          urlPortal:     process.env.NEXT_PUBLIC_APP_URL ?? '',
        })
        .catch((err) => logger.error('[cliente-upload] falha ao enviar email', err instanceof Error ? err : undefined));
    }

    // ------------------------------------------------------------------
    // 8. Resposta de sucesso
    // ------------------------------------------------------------------
    return NextResponse.json(
      {
        documento: {
          id:        resultado.documento.id,
          fileName:  resultado.documento.fileName,
          fileType:  resultado.documento.fileType,
          sector:    resultado.documento.sector,
          createdAt: resultado.documento.createdAt.toISOString(),
        },
        tarefa: {
          id:           resultado.tarefa.id,
          title:        resultado.tarefa.title,
          currentState: resultado.tarefa.currentState,
          sector:       resultado.tarefa.sector,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[POST /documentos/cliente-upload] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor ao processar o upload.' },
      { status: 500 },
    );
  }
}, ['CLIENT']);
