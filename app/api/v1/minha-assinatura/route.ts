import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../src/infrastructure/di/Container';
import { AsaasService } from '../../../../src/infrastructure/asaas/AsaasService';
import { logger } from '../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/minha-assinatura — Dados da assinatura do contador + cobranças
// =============================================================================
export const GET = withAuth(async (req: NextRequest, ctx, auth) => {
  try {
    const contadorId = auth.sub;

    const assinatura = await prisma.assinaturaSaaS.findUnique({
      where: { escritorioId: contadorId },
      include: {
        plano: {
          select: {
            nome: true,
            preco: true,
            features: true,
          },
        },
      },
    });

    if (!assinatura) {
      return NextResponse.json({
        hasAssinatura: false,
        message: 'Nenhuma assinatura SaaS encontrada para este escritório.',
      });
    }

    const cobrancas = await prisma.cobrancaSaaS.findMany({
      where: { escritorioId: contadorId },
      orderBy: { vencimento: 'desc' },
    });

    return NextResponse.json({
      hasAssinatura: true,
      assinatura: {
        id: assinatura.id,
        planoNome: assinatura.plano.nome,
        precoPlano: Number(assinatura.plano.preco),
        valorMensal: Number(assinatura.valorMensal),
        status: assinatura.status,
        diaVencimento: assinatura.diaVencimento,
        dataInicio: assinatura.dataInicio.toISOString(),
        dataRenovacao: assinatura.dataRenovacao.toISOString(),
        billingType: assinatura.billingType,
        observacoes: assinatura.observacoes,
        asaasSubscriptionId: assinatura.asaasSubscriptionId,
      },
      cobrancas: cobrancas.map((c) => ({
        id: c.id,
        valor: Number(c.valor),
        vencimento: c.vencimento.toISOString().substring(0, 10),
        mesReferencia: c.mesReferencia,
        status: c.status,
        asaasBoletoUrl: c.asaasBoletoUrl,
        asaasInvoiceUrl: c.asaasInvoiceUrl,
        asaasPixPayload: c.asaasPixPayload,
        asaasBarcode: c.asaasBarcode,
      })),
    });
  } catch (err) {
    logger.error('[GET /minha-assinatura] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// POST /api/v1/minha-assinatura — Atualiza assinatura para Cartão de Crédito
// =============================================================================
export const POST = withAuth(async (req: NextRequest, ctx, auth) => {
  try {
    const contadorId = auth.sub;
    const body = await req.json() as {
      holderName: string;
      number:     string;
      expiryMonth:string;
      expiryYear: string;
      ccv:        string;
      name:       string;
      email:      string;
      cpfCnpj:    string;
      postalCode: string;
      addressNumber: string;
      phone:      string;
    };

    const {
      holderName, number, expiryMonth, expiryYear, ccv,
      name, email, cpfCnpj, postalCode, addressNumber, phone
    } = body;

    if (!holderName || !number || !expiryMonth || !expiryYear || !ccv || !name || !email || !cpfCnpj || !postalCode || !addressNumber || !phone) {
      return NextResponse.json(
        { message: 'Todos os campos do cartão e informações do titular são obrigatórios.' },
        { status: 400 }
      );
    }

    const saasKey = process.env.ASAAS_SAAS_API_KEY;
    if (!saasKey) {
      return NextResponse.json({ message: 'ASAAS_SAAS_API_KEY não configurada.' }, { status: 503 });
    }

    const assinatura = await prisma.assinaturaSaaS.findUnique({
      where: { escritorioId: contadorId }
    });

    if (!assinatura || !assinatura.asaasSubscriptionId) {
      return NextResponse.json({ message: 'Assinatura recorrente não ativa/configurada no Asaas.' }, { status: 400 });
    }

    const BASE_URL = process.env.ASAAS_ENV === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    // Chama a API do Asaas para atualizar a assinatura para cartão de crédito
    const res = await fetch(`${BASE_URL}/subscriptions/${assinatura.asaasSubscriptionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': saasKey,
      },
      body: JSON.stringify({
        billingType: 'CREDIT_CARD',
        creditCard: {
          holderName,
          number: number.replace(/\s/g, ''),
          expiryMonth,
          expiryYear,
          ccv,
        },
        creditCardHolderInfo: {
          name,
          email,
          cpfCnpj: cpfCnpj.replace(/\D/g, ''),
          postalCode: postalCode.replace(/\D/g, ''),
          addressNumber,
          phone: phone.replace(/\D/g, ''),
        }
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      logger.warn('[POST /minha-assinatura] Falha ao atualizar cartão no Asaas', { error: errText });
      try {
        const errJson = JSON.parse(errText) as { errors?: { description: string }[] };
        const msg = errJson.errors?.[0]?.description ?? 'Erro desconhecido da API Asaas.';
        return NextResponse.json({ message: msg }, { status: 400 });
      } catch {
        return NextResponse.json({ message: `Falha ao salvar cartão no Asaas: ${errText}` }, { status: 400 });
      }
    }
    await prisma.assinaturaSaaS.update({
      where: { id: assinatura.id },
      data: {
        billingType: 'CREDIT_CARD',
      }
    });

    return NextResponse.json({ message: 'Cartão de crédito configurado com sucesso para pagamento recorrente!' });
  } catch (err) {
    logger.error('[POST /minha-assinatura] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
