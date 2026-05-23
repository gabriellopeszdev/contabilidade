import { NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '../../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/financeiro/boletos/[id]/download — Gera presigned URL para download
// =============================================================================

export const GET = withAuth(async (_req, ctx, auth) => {
  try {
    const { id } = await Promise.resolve(ctx.params);

    const boleto = await prisma.boletoHonorario.findUnique({ where: { id } });

    if (!boleto) {
      return NextResponse.json({ message: 'Boleto não encontrado.' }, { status: 404 });
    }

    // Normalizar EMPLOYEE
    let role = auth.role;
    if (role === 'EMPLOYEE' && auth.vinculo === 'ESCRITORIO' && auth.superiorId) {
      role = 'ACCOUNTANT';
    } else if (role === 'EMPLOYEE' && auth.vinculo === 'CLIENTE' && auth.superiorId) {
      role = 'CLIENT';
    }

    // Verificar acesso
    if (role === 'ACCOUNTANT') {
      const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
      if (boleto.escritorioId !== contadorId) {
        return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
      }
    } else if (role === 'CLIENT') {
      const clienteId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
      if (boleto.clienteId !== clienteId) {
        return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
      }
    } else if (role !== 'ADMIN') {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    // Asaas boleto — redirect to external URL directly
    if (boleto.asaasBoletoUrl) {
      return NextResponse.json({ url: boleto.asaasBoletoUrl, fileName: null, viaAsaas: true });
    }

    if (!boleto.storagePath) {
      return NextResponse.json({ message: 'Arquivo não disponível.' }, { status: 404 });
    }

    const { url } = await storageService.gerarPresignedUrlDownload(boleto.storagePath, 3600);

    return NextResponse.json({ url, fileName: boleto.fileName });
  } catch (err) {
    logger.error('[GET /financeiro/boletos/[id]/download] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'CLIENT', 'EMPLOYEE']);
