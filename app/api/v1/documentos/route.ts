import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

import { documentoRepository, prisma } from '../../../../src/infrastructure/di/Container';
import { logger }              from '../../../../src/utils/logger';
import type { SetorTipo }      from '../../../../src/domain/value-objects/Setor';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Tipos
// =============================================================================

interface ClienteJWTPayload extends JWTPayload {
  sub:  string;   // userId (UUID)
  role: 'CLIENT' | 'EMPLOYEE';
  nome: string;
  setores?:    string[];
  vinculo?:    string;
  superiorId?: string;
}

/** DTO serializado retornado pela API — sem entidades de domínio. */
export interface DocumentoClienteDTO {
  id:            string;
  fileName:      string;
  fileType:      'XML' | 'PDF';
  /** Tamanho em bytes. Mantemos como number — arquivos fiscais < 10 MB. */
  fileSizeBytes: number;
  sector:        SetorTipo;
  readStatus:    boolean;
  /** ISO 8601 string ou null. */
  readAt:        string | null;
  /** YYYY-MM-DD ou null. */
  competencia:   string | null;
  /** ISO 8601 string. */
  createdAt:     string;
  /** Origem do documento: enviado pelo cliente ou pelo escritório. */
  origem:        'UPLOAD_CLIENTE' | 'UPLOAD_CONTADOR';
  /** Nome de quem fez o upload. */
  uploaderNome:  string;
}

// =============================================================================
// Helper JWT — variante para role CLIENT
//
// Reutiliza o mesmo padrão de verificação da rota de upload (HS256 + jose).
// Rejeita qualquer token com role diferente de CLIENT.
// =============================================================================

async function verificarJWTCliente(
  request: NextRequest,
): Promise<
  | { ok: true;  payload: ClienteJWTPayload }
  | { ok: false; status: 401 | 403 | 500; mensagem: string }
> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      mensagem: 'Token de autorização ausente. Faça login para continuar.',
    };
  }

  const token  = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    logger.fatal('[GET /documentos] JWT_SECRET não configurado');
    return { ok: false, status: 500, mensagem: 'Erro de configuração do servidor.' };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ['HS256'] },
    );

    const typed = payload as ClienteJWTPayload;

    if (typed.role !== 'CLIENT' && typed.role !== 'EMPLOYEE') {
      return {
        ok: false,
        status: 403,
        mensagem: 'Acesso negado. Esta rota é exclusiva para clientes e funcionários.',
      };
    }

    // Funcionário com vínculo ESCRITORIO não pode listar documentos do cliente
    if (typed.role === 'EMPLOYEE' && typed.vinculo !== 'CLIENTE') {
      return {
        ok: false,
        status: 403,
        mensagem: 'Acesso negado. Funcionários de escritório não acessam esta rota.',
      };
    }

    return { ok: true, payload: typed };
  } catch {
    return {
      ok: false,
      status: 401,
      mensagem: 'Token inválido ou expirado. Faça login novamente.',
    };
  }
}

// =============================================================================
// GET /api/v1/documentos
//
// Lista os documentos do cliente autenticado com suporte a filtro por setor
// e paginação.
//
// Query params:
//   sector   → 'FISCAL' | 'PESSOAL' | 'CONTABIL' (opcional)
//   page     → inteiro >= 1 (padrão: 1)
//   perPage  → inteiro 1–100 (padrão: 20)
//
// Response 200:
//   { items: DocumentoClienteDTO[], total, page, perPage, totalPages,
//     hasPreviousPage, hasNextPage }
// =============================================================================

export async function GET(request: NextRequest) {
  // -------------------------------------------------------------------------
  // 1. Autenticação
  // -------------------------------------------------------------------------
  const authResult = await verificarJWTCliente(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { message: authResult.mensagem },
      { status: authResult.status },
    );
  }

  // Para EMPLOYEE, o clienteId é o superiorId (cliente dono)
  const { payload } = authResult;
  const clienteId = payload.role === 'EMPLOYEE'
    ? payload.superiorId!
    : payload.sub;

  // -------------------------------------------------------------------------
  // 2. Parâmetros de query
  // -------------------------------------------------------------------------
  const { searchParams } = request.nextUrl;

  const sectorParam = searchParams.get('sector')?.toUpperCase();
  const SETORES_VALIDOS: SetorTipo[] = ['FISCAL', 'PESSOAL', 'CONTABIL'];
  let sector = SETORES_VALIDOS.includes(sectorParam as SetorTipo)
    ? (sectorParam as SetorTipo)
    : undefined;

  // EMPLOYEE: trava obrigatória de setor — filtra APENAS setores autorizados
  // Se possuir TODOS, o funcionário é gerente e vê documentos de qualquer setor
  const setoresPermitidos = payload.setores as SetorTipo[] | undefined;
  const temAcessoTotal = setoresPermitidos?.includes('TODOS');

  if (payload.role === 'EMPLOYEE' && setoresPermitidos?.length && !temAcessoTotal) {
    if (sector && !setoresPermitidos.includes(sector)) {
      // Pediu um setor que não tem permissão → retorna vazio
      return NextResponse.json({
        items: [], total: 0, page: 1, perPage: 20,
        totalPages: 0, hasPreviousPage: false, hasNextPage: false,
      });
    }
    // Se não especificou setor, usa o primeiro setor permitido se for apenas um
    if (!sector && setoresPermitidos.length === 1) {
      sector = setoresPermitidos[0];
    }
  }

  const pageRaw    = parseInt(searchParams.get('page')    ?? '1',  10);
  const perPageRaw = parseInt(searchParams.get('perPage') ?? '20', 10);

  const page    = Number.isFinite(pageRaw)    && pageRaw    >= 1   ? pageRaw    : 1;
  const perPage = Number.isFinite(perPageRaw) && perPageRaw >= 1
    && perPageRaw <= 100 ? perPageRaw : 20;

  // Monta o filtro final (setor único ou múltiplos para EMPLOYEE)
  // TODOS → sem restrição de setor (gerente vê tudo)
  const filtroFinal: Record<string, unknown> = {};
  if (temAcessoTotal) {
    // Nenhum filtro de setor — traz documentos de todos os setores
  } else if (sector) {
    filtroFinal.sector = sector;
  } else if (payload.role === 'EMPLOYEE' && setoresPermitidos && setoresPermitidos.length > 1) {
    filtroFinal.setores = setoresPermitidos;
  }

  // -------------------------------------------------------------------------
  // 3. Busca no repositório
  // -------------------------------------------------------------------------
  try {
    const resultado = await documentoRepository.listarPorCliente(
      clienteId,
      Object.keys(filtroFinal).length > 0 ? filtroFinal : undefined,
      { page, perPage },
    );

    // -----------------------------------------------------------------------
    // 4. Resolver nomes dos uploaders (origem do documento)
    // -----------------------------------------------------------------------
    const uploaderIds = [...new Set(resultado.items.map((d) => d.uploadedById))];

    const [clientesUp, contadoresUp] = await Promise.all([
      prisma.usuarioCliente.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true },
      }),
      prisma.usuarioContador.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true },
      }),
    ]);

    const uploaderMap = new Map<string, { nome: string; origem: 'UPLOAD_CLIENTE' | 'UPLOAD_CONTADOR' }>();
    for (const c of clientesUp)   uploaderMap.set(c.id, { nome: c.name, origem: 'UPLOAD_CLIENTE' });
    for (const c of contadoresUp) uploaderMap.set(c.id, { nome: c.name, origem: 'UPLOAD_CONTADOR' });

    // -----------------------------------------------------------------------
    // 5. Serialização: entidades ricas → DTOs planos (sem refs de domínio)
    // -----------------------------------------------------------------------
    const items: DocumentoClienteDTO[] = resultado.items.map((doc) => {
      const uploader = uploaderMap.get(doc.uploadedById);
      return {
        id:            doc.id,
        fileName:      doc.fileName,
        fileType:      doc.fileType,
        fileSizeBytes: doc.fileSizeBytes,
        sector:        doc.sector.tipo,
        readStatus:    doc.readStatus,
        readAt:        doc.readAt?.toISOString()  ?? null,
        competencia:   doc.competencia
          ? doc.competencia.toISOString().split('T')[0]
          : null,
        createdAt:     doc.createdAt.toISOString(),
        origem:        uploader?.origem ?? 'UPLOAD_CONTADOR',
        uploaderNome:  uploader?.nome ?? 'Desconhecido',
      };
    });

    return NextResponse.json({
      items,
      total:           resultado.total,
      page:            resultado.page,
      perPage:         resultado.perPage,
      totalPages:      resultado.totalPages,
      hasPreviousPage: resultado.hasPreviousPage,
      hasNextPage:     resultado.hasNextPage,
    });

  } catch (err) {
    logger.error('[GET /documentos] Erro interno', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno ao carregar documentos.' },
      { status: 500 },
    );
  }
}
