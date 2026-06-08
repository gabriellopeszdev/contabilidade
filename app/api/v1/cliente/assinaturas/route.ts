import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { storageService, prisma } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// =============================================================================
// GET /api/v1/cliente/assinaturas
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const clienteId = auth.vinculo === 'CLIENTE' && auth.superiorId
      ? auth.superiorId
      : auth.sub;

    const now = new Date();

    const registros = await prisma.assinaturaDocumento.findMany({
      where: { signatarioId: clienteId },
      orderBy: { createdAt: 'desc' },
      include: {
        documento: {
          select: { id: true, fileName: true, fileType: true },
        },
      },
    });

    const assinaturas = registros.map((a) => {
      const statusEfetivo =
        a.status === 'PENDENTE' && a.expiresAt < now ? 'EXPIRADO' : a.status;

      return {
        id: a.id,
        status: statusEfetivo,
        documentoId: a.documentoId,
        documentoNome: a.documento.fileName,
        documentoTipo: a.documento.fileType,
        linkAssinatura:
          statusEfetivo === 'PENDENTE'
            ? `${process.env.NEXT_PUBLIC_APP_URL}/assinar/${a.tokenAssinatura}`
            : undefined,
        tokenAssinatura: a.tokenAssinatura,
        expiresAt: a.expiresAt,
        assinadoAt: a.assinadoAt,
        createdAt: a.createdAt,
        motivoRecusa: a.motivoRecusa,
        temComprovante: !!a.comprovanteStoragePath,
      };
    });

    return NextResponse.json({ assinaturas });
  } catch (err) {
    logger.error('[GET /cliente/assinaturas] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['CLIENT', 'EMPLOYEE']);

// =============================================================================
// POST /api/v1/cliente/assinaturas
// =============================================================================

export const POST = withAuth(async (req: NextRequest, _ctx, auth) => {
  try {
    const clienteId = auth.vinculo === 'CLIENTE' && auth.superiorId
      ? auth.superiorId
      : auth.sub;

    const formData = await req.formData();
    const arquivo = formData.get('arquivo') as File | null;

    if (!arquivo) {
      return NextResponse.json({ message: 'Arquivo é obrigatório.' }, { status: 400 });
    }

    if (arquivo.type !== 'application/pdf') {
      return NextResponse.json(
        { message: 'Apenas arquivos PDF são aceitos.' },
        { status: 400 },
      );
    }

    if (arquivo.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: 'O arquivo deve ter no máximo 10 MB.' },
        { status: 400 },
      );
    }

    const cc = await prisma.contadorCliente.findFirst({ where: { clienteId } });
    const contadorId = cc?.contadorId;

    if (!contadorId) {
      return NextResponse.json(
        { message: 'Cliente não possui contador vinculado.' },
        { status: 422 },
      );
    }

    const arrayBuffer = await arquivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const docId = crypto.randomUUID();
    const storagePath = `clientes/${clienteId}/assinaturas/${docId}.pdf`;

    await storageService.upload(storagePath, buffer, 'application/pdf');

    await prisma.documentoFiscal.create({
      data: {
        id: docId,
        clientId: clienteId,
        uploadedById: clienteId,
        storagePath,
        fileName: arquivo.name,
        fileType: 'PDF',
        fileSizeBytes: buffer.byteLength,
        fileHash,
        sector: 'CONTABIL',
      },
    });

    const user = await prisma.usuarioCliente.findUnique({
      where: { id: clienteId },
      select: { email: true },
    });

    const token = crypto.randomBytes(48).toString('hex');
    const now = new Date();

    const assinatura = await prisma.assinaturaDocumento.create({
      data: {
        documentoId: docId,
        solicitanteId: contadorId,
        signatarioId: clienteId,
        signatarioEmail: user?.email ?? '',
        signatarioNome: auth.nome ?? 'Cliente',
        status: 'ASSINADO',
        tokenAssinatura: token,
        expiresAt: now,
        assinadoAt: now,
        hashDocumento: fileHash,
        comprovanteStoragePath: storagePath,
        provider: 'INTERNO',
      },
    });

    return NextResponse.json(
      { ok: true, assinaturaId: assinatura.id, documentoId: docId },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[POST /cliente/assinaturas] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['CLIENT', 'EMPLOYEE']);
