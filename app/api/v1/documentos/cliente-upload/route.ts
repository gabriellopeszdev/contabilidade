import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

import { withAuth }        from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Constantes de validação
// =============================================================================

const SETORES_VALIDOS = ['FISCAL', 'PESSOAL', 'CONTABIL'] as const;
type SetorTipo = (typeof SETORES_VALIDOS)[number];

const TIPOS_ACEITOS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/xml': 'XML',
  'text/xml':        'XML',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// =============================================================================
// POST /api/v1/documentos/cliente-upload
//
// Upload de documento avulso feito pelo CLIENTE.
//
// O cliente seleciona um arquivo e o setor de destino (Fiscal, Pessoal,
// Contábil). O sistema:
//   1. Valida o arquivo (tipo, tamanho) e o setor
//   2. Calcula SHA-256 para deduplicação
//   3. Salva o binário no MinIO
//   4. Cria o registro DocumentoFiscal
//   5. Cria uma TarefaKanban (PENDING) direcionada ao contador responsável
//   6. Registra AuditLog
//
// FormData esperado:
//   arquivo  → File (PDF ou XML, máx 10 MB)
//   setor    → 'FISCAL' | 'PESSOAL' | 'CONTABIL'
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
    const formData = await req.formData();
    const arquivo  = formData.get('arquivo') as File | null;
    const setor    = (formData.get('setor') as string)?.toUpperCase() as SetorTipo;

    if (!arquivo || !(arquivo instanceof File) || arquivo.size === 0) {
      return NextResponse.json(
        { message: 'O campo "arquivo" é obrigatório e deve conter um arquivo válido.' },
        { status: 400 },
      );
    }

    if (!setor || !SETORES_VALIDOS.includes(setor)) {
      return NextResponse.json(
        { message: `Setor inválido. Valores aceitos: ${SETORES_VALIDOS.join(', ')}.` },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------------
    // 2. Validar tipo e tamanho
    // ------------------------------------------------------------------
    const fileType = TIPOS_ACEITOS[arquivo.type];
    if (!fileType) {
      return NextResponse.json(
        { message: 'Tipo de arquivo não permitido. Envie PDF ou XML.' },
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
    // 3. Ler conteúdo e calcular SHA-256
    // ------------------------------------------------------------------
    const buffer   = Buffer.from(await arquivo.arrayBuffer());
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
    const storagePath = `clientes/${auth.sub}/${setor.toLowerCase()}/${timestamp}_${safeName}`;

    await storageService.upload(storagePath, buffer, arquivo.type);

    // ------------------------------------------------------------------
    // 5. Buscar o contador responsável (primeiro vínculo ativo)
    // ------------------------------------------------------------------
    const vinculo = await prisma.contadorCliente.findFirst({
      where: { clienteId: auth.sub },
      select: { contadorId: true },
    });

    // ------------------------------------------------------------------
    // 6. Criar DocumentoFiscal + TarefaKanban em transação
    // ------------------------------------------------------------------
    const resultado = await prisma.$transaction(async (tx) => {
      const documento = await tx.documentoFiscal.create({
        data: {
          clientId:      auth.sub,
          uploadedById:  auth.sub,
          sector:        setor,
          fileName:      arquivo.name,
          storagePath,
          fileType:      fileType as 'PDF' | 'XML',
          fileSizeBytes: BigInt(arquivo.size),
          fileHash,
        },
      });

      const SETOR_LABELS: Record<string, string> = {
        FISCAL:   'Fiscal',
        PESSOAL:  'Pessoal',
        CONTABIL: 'Contábil',
      };

      const tarefa = await tx.tarefaKanban.create({
        data: {
          clientId:     auth.sub,
          assignedTo:   vinculo?.contadorId ?? null,
          documentId:   documento.id,
          sector:       setor,
          title:        `[${SETOR_LABELS[setor]}] ${arquivo.name}`,
          description:  `Documento enviado pelo cliente — Setor ${SETOR_LABELS[setor]}`,
          currentState: 'PENDING',
          priority:     'MEDIUM',
          position:     0,
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
            sector:      setor,
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
    // 7. Resposta de sucesso
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
