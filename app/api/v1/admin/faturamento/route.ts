import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../src/infrastructure/di/Container';
import { AsaasService } from '../../../../../src/infrastructure/asaas/AsaasService';
import { logger } from '../../../../../src/utils/logger';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/admin/faturamento — Lista todas as cobranças SaaS + métricas
// =============================================================================
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const escritorioId = url.searchParams.get('escritorioId') || undefined;

    const cobrancas = await prisma.cobrancaSaaS.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(escritorioId ? { escritorioId } : {}),
      },
      include: {
        escritorio: {
          select: {
            id: true,
            name: true,
            email: true,
            configuracao: { select: { nomeEscritorio: true, cnpjEscritorio: true } },
          },
        },
        assinatura: {
          select: {
            plano: { select: { nome: true } },
            valorMensal: true,
          },
        },
      },
      orderBy: { vencimento: 'desc' },
    });

    const totalPagas = cobrancas
      .filter((c) => c.status === 'PAGO')
      .reduce((acc, c) => acc + Number(c.valor), 0);
    const totalPendentes = cobrancas
      .filter((c) => c.status === 'PENDENTE')
      .reduce((acc, c) => acc + Number(c.valor), 0);
    const totalVencidas = cobrancas
      .filter((c) => c.status === 'VENCIDO')
      .reduce((acc, c) => acc + Number(c.valor), 0);

    return NextResponse.json({
      cobrancas: cobrancas.map((c) => ({
        id: c.id,
        escritorioId: c.escritorioId,
        escritorioNome: c.escritorio.configuracao?.nomeEscritorio ?? c.escritorio.name,
        escritorioEmail: c.escritorio.email,
        planoNome: c.assinatura?.plano?.nome ?? 'Sem Plano',
        valor: Number(c.valor),
        vencimento: c.vencimento.toISOString().substring(0, 10),
        mesReferencia: c.mesReferencia,
        status: c.status,
        asaasPaymentId: c.asaasPaymentId,
        asaasBoletoUrl: c.asaasBoletoUrl,
        asaasInvoiceUrl: c.asaasInvoiceUrl,
      })),
      stats: {
        totalPagas,
        totalPendentes,
        totalVencidas,
        totalGeral: totalPagas + totalPendentes + totalVencidas,
      },
    });
  } catch (err) {
    logger.error('[GET /admin/faturamento] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);

// =============================================================================
// POST /api/v1/admin/faturamento — Cria assinatura recorrente ou cobrança avulsa
// =============================================================================
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json() as {
      action:          'criar_assinatura' | 'criar_cobranca_avulsa';
      escritorioId:    string;
      valor?:          number;
      vencimento?:     string; // YYYY-MM-DD
      descricao?:      string;
      billingType?:    'BOLETO' | 'PIX' | 'CREDIT_CARD';
    };

    const { action, escritorioId, valor, vencimento, descricao, billingType = 'BOLETO' } = body;

    if (!escritorioId) {
      return NextResponse.json({ message: 'escritorioId é obrigatório.' }, { status: 400 });
    }

    const saasKey = process.env.ASAAS_SAAS_API_KEY;
    if (!saasKey) {
      return NextResponse.json({ message: 'ASAAS_SAAS_API_KEY não configurada.' }, { status: 503 });
    }

    const escritorio = await prisma.usuarioContador.findUnique({
      where: { id: escritorioId },
      include: {
        configuracao: true,
        assinaturaSaaS: true,
      },
    });

    if (!escritorio) {
      return NextResponse.json({ message: 'Escritório não encontrado.' }, { status: 404 });
    }

    const assinatura = escritorio.assinaturaSaaS;
    if (!assinatura) {
      return NextResponse.json(
        { message: 'Escritório não possui assinatura SaaS configurada no banco.' },
        { status: 400 }
      );
    }

    // Instancia o serviço com a chave da plataforma
    const svc = new AsaasService(saasKey);

    // Obter documento do escritório
    const documento = escritorio.configuracao?.cnpjEscritorio?.replace(/\D/g, '') || '';
    if (!documento) {
      return NextResponse.json(
        { message: 'O escritório precisa ter um CNPJ/CPF cadastrado nas configurações do white-label.' },
        { status: 400 }
      );
    }

    const customerId = await svc.criarOuBuscarCliente(
      documento,
      escritorio.configuracao?.nomeEscritorio ?? escritorio.name,
      escritorio.email
    );

    // Atualiza asaasCustomerId no banco se for novo
    if (assinatura.asaasCustomerId !== customerId) {
      await prisma.assinaturaSaaS.update({
        where: { id: assinatura.id },
        data: { asaasCustomerId: customerId },
      });
      assinatura.asaasCustomerId = customerId;
    }

    if (action === 'criar_assinatura') {
      if (assinatura.asaasSubscriptionId) {
        return NextResponse.json(
          { message: 'Este escritório já possui uma assinatura recorrente configurada no Asaas.', subscriptionId: assinatura.asaasSubscriptionId },
          { status: 400 }
        );
      }

      const valorMensal = valor ?? Number(assinatura.valorMensal);
      const diaVenc = assinatura.diaVencimento;

      let nextDue = vencimento;
      if (!nextDue) {
        const d = new Date(assinatura.dataRenovacao);
        if (d.getTime() > Date.now()) {
          nextDue = d.toISOString().split('T')[0];
        } else {
          const now = new Date();
          const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, diaVenc);
          nextDue = targetDate.toISOString().split('T')[0];
        }
      }

      const sub = await svc.criarAssinatura({
        customerId,
        valor: valorMensal,
        nextDueDate: nextDue,
        cycle: 'MONTHLY',
        billingType: billingType === 'CREDIT_CARD' ? 'UNDEFINED' : billingType,
        descricao: descricao ?? `Mensalidade SaaS FiscoHub — ${escritorio.configuracao?.nomeEscritorio ?? escritorio.name}`,
        externalReference: assinatura.id,
      });

      await prisma.assinaturaSaaS.update({
        where: { id: assinatura.id },
        data: {
          asaasSubscriptionId: sub.id,
          billingType: billingType,
        },
      });

      return NextResponse.json({
        message: 'Assinatura recorrente criada com sucesso no Asaas.',
        subscriptionId: sub.id,
      }, { status: 201 });
    }

    if (action === 'criar_cobranca_avulsa') {
      if (!valor || valor <= 0) {
        return NextResponse.json({ message: 'valor positivo é obrigatório para cobrança avulsa.' }, { status: 400 });
      }
      if (!vencimento) {
        return NextResponse.json({ message: 'vencimento (YYYY-MM-DD) é obrigatório.' }, { status: 400 });
      }

      const payment = await svc.criarBoleto({
        customerId,
        valor: valor,
        vencimento: vencimento,
        billingType: billingType === 'CREDIT_CARD' ? 'UNDEFINED' : billingType,
        descricao: descricao ?? `Fatura SaaS Avulsa — ${escritorio.configuracao?.nomeEscritorio ?? escritorio.name}`,
        externalReference: assinatura.id,
      });

      const fetchBarcode = billingType !== 'PIX';
      const fetchPix     = billingType !== 'BOLETO';

      const [barcode, pix] = await Promise.all([
        fetchBarcode ? svc.buscarLinhaDigitavel(payment.id) : Promise.resolve(null),
        fetchPix     ? svc.buscarPixQrCode(payment.id)      : Promise.resolve(null),
      ]);

      const cobranca = await prisma.cobrancaSaaS.create({
        data: {
          assinaturaId:    assinatura.id,
          escritorioId:    escritorioId,
          valor:           new Prisma.Decimal(valor),
          vencimento:      new Date(vencimento),
          mesReferencia:   vencimento.substring(0, 7),
          status:          'PENDENTE',
          asaasPaymentId:  payment.id,
          asaasBoletoUrl:  payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
          asaasInvoiceUrl: payment.invoiceUrl ?? null,
          asaasPixPayload: pix,
          asaasBarcode:    barcode,
        },
      });

      return NextResponse.json({
        message: 'Cobrança avulsa gerada com sucesso.',
        cobranca: {
          id: cobranca.id,
          valor: Number(cobranca.valor),
          vencimento: cobranca.vencimento.toISOString().substring(0, 10),
          status: cobranca.status,
          asaasBoletoUrl: cobranca.asaasBoletoUrl,
          asaasPixPayload: cobranca.asaasPixPayload,
          asaasBarcode: cobranca.asaasBarcode,
        },
      }, { status: 201 });
    }

    return NextResponse.json({ message: 'Ação inválida.' }, { status: 400 });
  } catch (err) {
    logger.error('[POST /admin/faturamento] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
