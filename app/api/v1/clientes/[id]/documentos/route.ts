import { NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/clientes/[id]/documentos
//
// Retorna o histórico completo de documentos de um cliente específico.
// O contador vê tudo que foi enviado (por ele ou pelo cliente) para a empresa.
//
// Inclui:
//   - Origem do documento (UPLOAD_CONTADOR vs UPLOAD_CLIENTE)
//   - Data/hora exata da leitura pelo cliente (readAt)
//   - Nome de quem fez o upload (JOIN em UsuarioCliente + UsuarioContador)
//
// Query params:
//   setor         → FISCAL | PESSOAL | CONTABIL (filtro opcional)
//   statusLeitura → lido | nao_lido (filtro opcional)
//   busca         → filtro parcial por fileName (opcional)
//
// Respostas:
//   200 OK  → { cliente, resumo, documentos }
//   403     → cliente não pertence ao contador
//   404     → cliente não encontrado
// =============================================================================

const SETORES_VALIDOS = ['FISCAL', 'PESSOAL', 'CONTABIL'] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withAuth(async (req, ctx, auth) => {
  const { id: clienteId } = (ctx as ResolvedRouteContext).params;

  // Validar UUID
  if (!UUID_REGEX.test(clienteId)) {
    return NextResponse.json(
      { message: 'ID do cliente inválido.' },
      { status: 400 },
    );
  }

  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
    // -----------------------------------------------------------------------
    // 1. Verificação IDOR: cliente pertence ao contador?
    // -----------------------------------------------------------------------
    const vinculo = await prisma.contadorCliente.findUnique({
      where: {
        contadorId_clienteId: {
          contadorId,
          clienteId,
        },
      },
      select: {
        assignedAt: true,
        cliente: {
          select: {
            id:    true,
            name:  true,
            email: true,
            cnpj:  true,
            phone: true,
          },
        },
      },
    });

    if (!vinculo) {
      return NextResponse.json(
        { message: 'Cliente não encontrado ou não pertence à sua carteira.' },
        { status: 403 },
      );
    }

    // -----------------------------------------------------------------------
    // 2. Parse dos filtros
    // -----------------------------------------------------------------------
    const { searchParams } = req.nextUrl;
    const setorParam       = searchParams.get('setor')?.toUpperCase();
    const statusLeitura    = searchParams.get('statusLeitura');
    const busca            = searchParams.get('busca')?.trim();

    const where: Record<string, unknown> = {
      clientId:  clienteId,
      deletedAt: null,
    };

    // Funcionário: filtrar por setores permitidos (exceto se TODOS)
    if (auth.role === 'EMPLOYEE' && auth.setores && !auth.setores.includes('TODOS')) {
      where.sector = { in: auth.setores };
    }

    if (setorParam && SETORES_VALIDOS.includes(setorParam as typeof SETORES_VALIDOS[number])) {
      where.sector = setorParam;
    }

    if (statusLeitura === 'lido') {
      where.readStatus = true;
    } else if (statusLeitura === 'nao_lido') {
      where.readStatus = false;
    }

    if (busca) {
      where.fileName = { contains: busca, mode: 'insensitive' };
    }

    // -----------------------------------------------------------------------
    // 3. Buscar documentos + contagem para resumo
    // -----------------------------------------------------------------------
    const [documentos, totalDocs, docsLidos] = await Promise.all([
      prisma.documentoFiscal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id:            true,
          uploadedById:  true,
          sector:        true,
          fileName:      true,
          fileType:      true,
          fileSizeBytes: true,
          readStatus:    true,
          readAt:        true,
          competencia:   true,
          createdAt:     true,
        },
      }),

      // Total de documentos do cliente (sem filtros)
      prisma.documentoFiscal.count({
        where: { clientId: clienteId, deletedAt: null },
      }),

      // Total de documentos lidos
      prisma.documentoFiscal.count({
        where: { clientId: clienteId, deletedAt: null, readStatus: true },
      }),
    ]);

    // -----------------------------------------------------------------------
    // 4. Resolver nomes dos uploaders (origem do documento)
    // -----------------------------------------------------------------------
    const uploaderIds = [...new Set(documentos.map((d) => d.uploadedById))];

    const [clientes, contadores] = await Promise.all([
      prisma.usuarioCliente.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true },
      }),
      prisma.usuarioContador.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true },
      }),
    ]);

    // Mapa de id → { nome, tipo }
    const uploaderMap = new Map<string, { nome: string; origem: 'UPLOAD_CLIENTE' | 'UPLOAD_CONTADOR' }>();

    for (const c of clientes) {
      uploaderMap.set(c.id, { nome: c.name, origem: 'UPLOAD_CLIENTE' });
    }
    for (const c of contadores) {
      uploaderMap.set(c.id, { nome: c.name, origem: 'UPLOAD_CONTADOR' });
    }

    // -----------------------------------------------------------------------
    // 5. Serializar resposta
    // -----------------------------------------------------------------------
    const documentosDTO = documentos.map((d) => {
      const uploader = uploaderMap.get(d.uploadedById);
      return {
        id:            d.id,
        fileName:      d.fileName,
        fileType:      d.fileType,
        sector:        d.sector,
        fileSizeBytes: Number(d.fileSizeBytes),
        readStatus:    d.readStatus,
        readAt:        d.readAt?.toISOString() ?? null,
        competencia:   d.competencia?.toISOString().split('T')[0] ?? null,
        createdAt:     d.createdAt.toISOString(),
        origem:        uploader?.origem ?? 'UPLOAD_CONTADOR',
        uploaderNome:  uploader?.nome ?? 'Desconhecido',
      };
    });

    return NextResponse.json({
      cliente: {
        id:    vinculo.cliente.id,
        nome:  vinculo.cliente.name,
        email: vinculo.cliente.email,
        cnpj:  vinculo.cliente.cnpj,
        phone: vinculo.cliente.phone,
      },
      resumo: {
        total:     totalDocs,
        lidos:     docsLidos,
        pendentes: totalDocs - docsLidos,
      },
      documentos: documentosDTO,
    });
  } catch (err) {
    logger.error('[GET /clientes/[id]/documentos] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
