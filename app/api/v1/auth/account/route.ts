import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

import {
  prisma,
  storageService,
} from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// DELETE /api/v1/auth/account — Exclusão de conta e anonimização (LGPD)
//
// Fluxo:
//   1. Remove arquivos do MinIO (documentos do cliente)
//   2. Soft-delete documentos fiscais
//   3. Anonimiza dados pessoais do usuário
//   4. Desvincula contadores
//   5. Registra audit log ACCOUNT_DELETED
// =============================================================================

export async function DELETE(request: NextRequest) {
  const auth = await extrairPayload(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.mensagem }, { status: auth.status });
  }

  const { sub, role } = auth.payload;

  const ipAddress =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0';
  const userAgent = request.headers.get('user-agent') ?? null;

  try {
    if (role === 'CLIENT') {
      await excluirContaCliente(sub, ipAddress, userAgent);
    } else {
      await excluirContaContador(sub, ipAddress, userAgent);
    }

    return NextResponse.json({ message: 'Conta excluída e dados anonimizados com sucesso.' });
  } catch (err) {
    logger.error('[account-delete] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro ao processar exclusão da conta. Tente novamente.' },
      { status: 500 },
    );
  }
}

// =============================================================================
// Exclusão de conta CLIENTE
// =============================================================================

async function excluirContaCliente(
  clienteId: string,
  ipAddress: string,
  userAgent: string | null,
) {
  // 1. Buscar documentos com storagePath para deletar do MinIO
  const documentos = await prisma.documentoFiscal.findMany({
    where: { clientId: clienteId, deletedAt: null },
    select: { id: true, storagePath: true },
  });

  // 2. Deletar arquivos do MinIO
  if (documentos.length > 0) {
    const paths = documentos.map((d) => d.storagePath);
    try {
      await storageService.deletarLote(paths);
    } catch (err) {
      logger.warn('[account-delete] Falha ao deletar arquivos do MinIO', { error: err instanceof Error ? err.message : String(err) });
      // Non-blocking — prossegue com anonimização no banco
    }
  }

  const now = new Date();
  const anonEmail = `anonimizado_${clienteId.slice(0, 8)}@removed.lgpd`;

  await prisma.$transaction([
    // 3. Soft-delete documentos
    prisma.documentoFiscal.updateMany({
      where: { clientId: clienteId, deletedAt: null },
      data: { deletedAt: now },
    }),

    // 4. Remover vínculos com contadores
    prisma.contadorCliente.deleteMany({
      where: { clienteId: clienteId },
    }),

    // 5. Anonimizar dados pessoais
    prisma.usuarioCliente.update({
      where: { id: clienteId },
      data: {
        name: 'Usuário Removido',
        email: anonEmail,
        passwordHash: 'REMOVED',
        cnpj: clienteId.slice(0, 14).padEnd(14, '0'),
        phone: null,
        avatarUrl: null,
        isActive: false,
        deletedAt: now,
      },
    }),

    // 6. Audit log
    prisma.auditLog.create({
      data: {
        userId: clienteId,
        actionType: 'ACCOUNT_DELETED',
        resourceType: 'USER',
        ipAddress,
        userAgent,
        detailsJson: {
          role: 'CLIENT',
          documentosRemovidos: documentos.length,
          anonimizadoEm: now.toISOString(),
        },
      },
    }),
  ]);
}

// =============================================================================
// Exclusão de conta CONTADOR
// =============================================================================

async function excluirContaContador(
  contadorId: string,
  ipAddress: string,
  userAgent: string | null,
) {
  const now = new Date();
  const anonEmail = `anonimizado_${contadorId.slice(0, 8)}@removed.lgpd`;

  await prisma.$transaction([
    // 1. Desassociar tarefas
    prisma.tarefaKanban.updateMany({
      where: { assignedTo: contadorId },
      data: { assignedTo: null },
    }),

    // 2. Remover vínculos com clientes
    prisma.contadorCliente.deleteMany({
      where: { contadorId: contadorId },
    }),

    // 3. Anonimizar dados pessoais
    prisma.usuarioContador.update({
      where: { id: contadorId },
      data: {
        name: 'Contador Removido',
        email: anonEmail,
        passwordHash: 'REMOVED',
        crc: `REMOVED_${contadorId.slice(0, 8)}`,
        phone: null,
        avatarUrl: null,
        isActive: false,
        deletedAt: now,
      },
    }),

    // 4. Audit log
    prisma.auditLog.create({
      data: {
        userId: contadorId,
        actionType: 'ACCOUNT_DELETED',
        resourceType: 'USER',
        ipAddress,
        userAgent,
        detailsJson: {
          role: 'ACCOUNTANT',
          anonimizadoEm: now.toISOString(),
        },
      },
    }),
  ]);
}

// =============================================================================
// Helper — Extrair payload JWT
// =============================================================================

interface JWTInfo {
  sub: string;
  role: 'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
}

async function extrairPayload(
  request: NextRequest,
): Promise<{ ok: true; payload: JWTInfo } | { ok: false; status: 401 | 500; mensagem: string }> {
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
    return { ok: false, status: 500, mensagem: 'Erro de configuração do servidor.' };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ['HS256'] },
    );
    return {
      ok: true,
      payload: {
        sub: payload.sub as string,
        role: payload.role as JWTInfo['role'],
      },
    };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido ou expirado.' };
  }
}
