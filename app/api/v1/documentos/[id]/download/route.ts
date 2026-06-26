import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

import {
  prisma,
  storageService,
  registrarLeituraDocumentoUseCase,
} from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';
import { DomainException } from '../../../../../../src/domain/exceptions/DomainException';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Tipos
// =============================================================================

interface DownloadJWTPayload extends JWTPayload {
  sub:  string;
  role: 'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
  nome: string;
}

// =============================================================================
// Helper JWT — aceita CLIENT e ACCOUNTANT/ADMIN
// =============================================================================

async function verificarJWT(
  request: NextRequest,
): Promise<
  | { ok: true;  payload: DownloadJWTPayload }
  | { ok: false; status: 401 | 500; mensagem: string }
> {
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    token = request.cookies.get('contabilidade_jwt')?.value ?? null;
  }

  if (!token) {
    return { ok: false, status: 401, mensagem: 'Token de autorização ausente.' };
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    logger.fatal('[download] JWT_SECRET não configurado');
    return { ok: false, status: 500, mensagem: 'Erro de configuração do servidor.' };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ['HS256'] },
    );

    return { ok: true, payload: payload as DownloadJWTPayload };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido ou expirado.' };
  }
}

// =============================================================================
// GET /api/v1/documentos/:id/download
//
// Fluxo:
//   1. Verifica JWT (role: CLIENT)
//   2. Busca o documento no banco (Prisma direto — query side)
//      → Verificação de ownership: clientId === JWT.sub
//   3. Busca o contador responsável pelo cliente (para WebSocket notification)
//   4. Extrai IP/UA para rastreabilidade
//   5. Executa RegistrarLeituraDocumentoUseCase (audit + evento WS)
//   6. Gera Presigned URL de download do MinIO (válida por 5 min)
//   7. Retorna { url, expiresAt, primeiraLeitura, nomeArquivo }
//
// DESIGN DE SEGURANÇA:
//   - Ownership verificado DUAS vezes (defense in depth):
//       a) No route handler via query `clientId = JWT.sub`
//       b) Dentro do use case (validarInput + comparação na entidade)
//   - Mensagem de erro genérica: não vaza se o documento existe ou não.
//   - URL de presigned expira em 300s (5 min) — janela curta por segurança.
//
// SEPARAÇÃO CQRS-lite:
//   - Query (storagePath): Prisma direto — mais simples para a camada HTTP
//   - Command (registrar leitura): use case — mantém as regras de negócio
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // -------------------------------------------------------------------------
  // 1. Autenticação
  // -------------------------------------------------------------------------
  const authResult = await verificarJWT(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { message: authResult.mensagem },
      { status: authResult.status },
    );
  }

  const userId  = authResult.payload.sub;
  const role    = authResult.payload.role;
  const { id: documentoId } = await params;

  if (!documentoId?.match(/^[0-9a-f-]{36}$/i)) {
    return NextResponse.json(
      { message: 'ID de documento inválido.' },
      { status: 400 },
    );
  }

  // -------------------------------------------------------------------------
  // 2. Busca o documento e verifica autorização por role
  //
  //    CLIENT: clientId === JWT.sub
  //    ACCOUNTANT/ADMIN: deve estar vinculado ao cliente via ContadorCliente
  // -------------------------------------------------------------------------
  let docRow: { storagePath: string; fileName: string; clientId: string } | null = null;

  if (role === 'CLIENT') {
    docRow = await prisma.documentoFiscal.findFirst({
      where:  { id: documentoId, clientId: userId, deletedAt: null },
      select: { storagePath: true, fileName: true, clientId: true },
    });
  } else {
    // ACCOUNTANT/ADMIN — busca o documento e verifica vínculo
    const doc = await prisma.documentoFiscal.findFirst({
      where:  { id: documentoId, deletedAt: null },
      select: { storagePath: true, fileName: true, clientId: true },
    });

    if (doc) {
      const vinculo = await prisma.contadorCliente.findFirst({
        where: { contadorId: userId, clienteId: doc.clientId },
      });
      if (vinculo) docRow = doc;
    }
  }

  if (!docRow) {
    return NextResponse.json(
      { message: 'Documento não encontrado ou sem permissão de acesso.' },
      { status: 404 },
    );
  }

  const clienteId = docRow.clientId;

  // -------------------------------------------------------------------------
  // 3. Busca o contador responsável pelo cliente
  // -------------------------------------------------------------------------
  const contadorCliente = await prisma.contadorCliente.findFirst({
    where:   { clienteId },
    select:  { contadorId: true },
    orderBy: { assignedAt: 'asc' },
  });

  const contadorResponsavelId = contadorCliente?.contadorId ?? null;

  // -------------------------------------------------------------------------
  // 4. Extrai IP e User-Agent para o AuditLog
  // -------------------------------------------------------------------------
  const ipAddress =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0';

  const userAgent = request.headers.get('user-agent') ?? undefined;

  // -------------------------------------------------------------------------
  // 5. Use Case: Registrar Leitura (command side)
  //
  //    Idempotente: se já foi lido, apenas grava o AuditLog sem re-emitir evento.
  //    Falha aqui NÃO deve bloquear o download — o arquivo existe e o cliente
  //    tem direito ao acesso. Por isso capturamos a exceção separadamente.
  // -------------------------------------------------------------------------
  let primeiraLeitura = false;

  try {
    const resultado = await registrarLeituraDocumentoUseCase.executar({
      documentoId,
      clienteId,
      contadorResponsavelId,
      ipAddress,
      userAgent,
      visualizadoPorId: userId,
      visualizadoPorRole: role,
    });
    primeiraLeitura = resultado.primeiraLeitura;
  } catch (err) {
    if (err instanceof DomainException) {
      // Ownership falhou no use case (não deveria, já checamos acima)
      return NextResponse.json({ message: err.message }, { status: 403 });
    }
    // Falha de infraestrutura: loga mas não bloqueia o download
    logger.warn('[download] Falha ao registrar leitura (não-bloqueante)', { error: err instanceof Error ? err.message : String(err) });
  }

  // -------------------------------------------------------------------------
  // 6. Gera Presigned URL de download
  //
  //    O arquivo binário vai DIRETAMENTE do MinIO para o browser,
  //    sem passar pelo Node.js (evita gargalo de banda no servidor).
  //    Expira em 300s (5 minutos) — curta por segurança (LGPD / auditoria).
  // -------------------------------------------------------------------------
  try {
    const EXPIRY_SECONDS = 300; // 5 minutos
    const { url, expiresAt } = await storageService.gerarPresignedUrlDownload(
      docRow.storagePath,
      EXPIRY_SECONDS,
      docRow.fileName,
    );

    return NextResponse.json({
      url,
      expiresAt:      expiresAt.toISOString(),
      primeiraLeitura,
      nomeArquivo:    docRow.fileName,
    });

  } catch (err) {
    logger.error('[download] Falha ao gerar Presigned URL', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Falha ao gerar link de download. Tente novamente.' },
      { status: 500 },
    );
  }
}
