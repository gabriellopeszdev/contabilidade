import { NextRequest, NextResponse }                                           from 'next/server';
import { withAuth, type ResolvedRouteContext }                                  from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, documentoRepository, queueProducer }                          from '../../../../../../../src/infrastructure/di/Container';
import { DocumentoFiscal }                                                      from '../../../../../../../src/domain/entities/DocumentoFiscal';
import { Setor }                                                                from '../../../../../../../src/domain/value-objects/Setor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACAO_PARA_STATUS = {
  confirmar:   'CONFIRMADA',
  rejeitar:    'REJEITADA',
  desconhecer: 'DESCONHECIDA',
} as const;

const ACAO_PARA_ACTION_TYPE = {
  confirmar:   'NOTA_PENDENTE_CONFIRMADA',
  rejeitar:    'NOTA_PENDENTE_REJEITADA',
  desconhecer: 'NOTA_PENDENTE_DESCONHECIDA',
} as const;

// POST /api/v1/clientes/[id]/notas-pendentes/[notaId]
// Executa uma ação sobre uma nota pendente: confirmar, rejeitar ou desconhecer.
export const POST = withAuth(async (req: NextRequest, ctx, auth) => {
  const { id: clienteId, notaId } = (ctx as ResolvedRouteContext).params;

  const vinculo = await prisma.contadorCliente.findUnique({
    where: { contadorId_clienteId: { contadorId: auth.sub, clienteId } },
    select: { clienteId: true },
  });
  if (!vinculo) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });

  const nota = await prisma.notaPendenteSefaz.findUnique({
    where: { id: notaId },
    select: {
      id:            true,
      clienteId:     true,
      storagePath:   true,
      fileHash:      true,
      fileSizeBytes: true,
      chaveAcesso:   true,
      status:        true,
    },
  });
  if (!nota || nota.clienteId !== clienteId) {
    return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 });
  }
  if (nota.status !== 'PENDENTE') {
    return NextResponse.json({ error: 'Esta nota já foi processada.' }, { status: 409 });
  }

  const body = await req.json() as { acao?: string };
  const acao = body.acao as keyof typeof ACAO_PARA_STATUS | undefined;
  if (!acao || !ACAO_PARA_STATUS[acao]) {
    return NextResponse.json({ error: 'Ação inválida. Use: confirmar, rejeitar ou desconhecer.' }, { status: 400 });
  }

  let documentoId: string | undefined;

  if (acao === 'confirmar') {
    // Verifica se já existe documento com esse hash (pode ter sido importado manualmente)
    const jaExiste = await documentoRepository.hashJaExiste(nota.fileHash, clienteId);
    if (jaExiste) {
      return NextResponse.json({ error: 'Esta nota já existe nos documentos do cliente.' }, { status: 409 });
    }

    const docId     = crypto.randomUUID();
    const documento = DocumentoFiscal.criar({
      id:            docId,
      clientId:      clienteId,
      uploadedById:  auth.sub,
      fileName:      `${nota.chaveAcesso}.xml`,
      fileType:      'XML',
      fileSizeBytes: Number(nota.fileSizeBytes),
      storagePath:   nota.storagePath,
      fileHash:      nota.fileHash,
      sector:        Setor.FISCAL,
      competencia:   null,
      metadataJson:  {},
    });
    await documentoRepository.salvar(documento);

    await queueProducer.add('PARSEAR_XML_NFE', {
      tipo:    'PARSEAR_XML_NFE',
      payload: { documentoId: docId, storagePath: nota.storagePath },
    }, { jobId: `PARSEAR_XML_NFE-${docId}` });

    documentoId = docId;
  }

  await prisma.notaPendenteSefaz.update({
    where: { id: notaId },
    data:  {
      status:        ACAO_PARA_STATUS[acao],
      revisadoPorId: auth.sub,
      revisadoEm:    new Date(),
      ...(documentoId ? { documentoId } : {}),
    },
  });

  // Audit log — fire-and-forget, sem storagePath/XML em detailsJson
  prisma.auditLog.create({
    data: {
      userId:       auth.sub,
      actionType:   ACAO_PARA_ACTION_TYPE[acao],
      resourceType: 'NOTA_PENDENTE_SEFAZ',
      detailsJson:  { notaId, clienteId, chaveAcesso: nota.chaveAcesso, documentoId: documentoId ?? null },
      ipAddress:    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                    ?? req.headers.get('x-real-ip')
                    ?? '127.0.0.1',
      userAgent:    req.headers.get('user-agent') ?? '',
    },
  }).catch(() => { /* fire-and-forget */ });

  return NextResponse.json({ ok: true, status: ACAO_PARA_STATUS[acao], documentoId: documentoId ?? null });
}, ['ACCOUNTANT']);
