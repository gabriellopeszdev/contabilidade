import { NextRequest, NextResponse } from 'next/server';
import { withAuth, ResolvedRouteContext, AuthPayload } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/minha-assinatura/status — Verifica inadimplência (endpoint leve)
// =============================================================================
export const GET = withAuth(async (req: NextRequest, ctx: ResolvedRouteContext, auth: AuthPayload) => {
  try {
    // Admins da plataforma nunca são bloqueados
    if (auth.role === 'ADMIN') {
      return NextResponse.json({ bloqueado: false });
    }

    let contadorId: string;

    if (auth.role === 'EMPLOYEE') {
      if (auth.vinculo === 'ESCRITORIO') {
        contadorId = auth.superiorId!;
      } else {
        // CLIENTE
        const vinculo = await prisma.contadorCliente.findFirst({
          where: { clienteId: auth.superiorId! },
          select: { contadorId: true },
        });
        if (!vinculo) return NextResponse.json({ bloqueado: false });
        contadorId = vinculo.contadorId;
      }
    } else if (auth.role === 'CLIENT') {
      const vinculo = await prisma.contadorCliente.findFirst({
        where: { clienteId: auth.sub },
        select: { contadorId: true },
      });
      if (!vinculo) return NextResponse.json({ bloqueado: false });
      contadorId = vinculo.contadorId;
    } else {
      contadorId = auth.sub;
    }

    const assinatura = await prisma.assinaturaSaaS.findUnique({
      where: { escritorioId: contadorId },
    });

    // Se o escritório não tem assinatura SaaS cadastrada, por padrão não bloqueamos
    // (pode ser um ambiente de teste ou admin sem plano).
    if (!assinatura) {
      return NextResponse.json({ bloqueado: false });
    }

    // Busca faturas vencidas no banco
    const cobrancaVencida = await prisma.cobrancaSaaS.findFirst({
      where: {
        escritorioId: contadorId,
        status: 'VENCIDO',
      },
      orderBy: { vencimento: 'asc' },
    });

    const isBlocked = assinatura.status === 'INADIMPLENTE' || !!cobrancaVencida;

    if (!isBlocked) {
      return NextResponse.json({ bloqueado: false });
    }

    // Se estiver bloqueado, retornamos os detalhes da cobrança vencida
    // (ou de uma pendente caso não encontre vencida explicitamente por inconsistência)
    const faturaPendente = cobrancaVencida || await prisma.cobrancaSaaS.findFirst({
      where: {
        escritorioId: contadorId,
        status: 'PENDENTE',
      },
      orderBy: { vencimento: 'asc' },
    });

    return NextResponse.json({
      bloqueado: true,
      motivo: 'inadimplencia',
      role: auth.role,
      vinculo: auth.vinculo,
      cobranca: faturaPendente ? {
        id: faturaPendente.id,
        valor: Number(faturaPendente.valor),
        vencimento: faturaPendente.vencimento.toISOString().substring(0, 10),
        asaasBoletoUrl: faturaPendente.asaasBoletoUrl,
        asaasInvoiceUrl: faturaPendente.asaasInvoiceUrl,
        asaasPixPayload: faturaPendente.asaasPixPayload,
        asaasBarcode: faturaPendente.asaasBarcode,
      } : null,
    });
  } catch (err) {
    logger.error('[GET /minha-assinatura/status] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE', 'CLIENT']);
