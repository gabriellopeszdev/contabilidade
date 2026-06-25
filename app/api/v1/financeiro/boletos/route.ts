import { NextResponse } from 'next/server';
import { z }           from 'zod';

import { withAuth }                          from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService, emailService } from '../../../../../src/infrastructure/di/Container';
import { logger }                 from '../../../../../src/utils/logger';
import { gerarBoletoPdf }         from '../../../../../src/infrastructure/pdf/gerarBoletoPdf';
import {
  emailWrapper, emailHeading, emailSubheading, emailText, emailInfoBox, emailButton, emailCallout,
} from '../../../../../src/infrastructure/email/emailTemplate';
import { AsaasService }           from '../../../../../src/infrastructure/asaas/AsaasService';
import { CoraService }            from '../../../../../src/infrastructure/cora/CoraService';

// =============================================================================
// Schema de validação do POST
// =============================================================================

const CriarBoletoSchema = z.object({
  clienteId: z
    .string({ required_error: 'Selecione um cliente.' })
    .uuid({ message: 'Cliente inválido.' }),

  valor: z
    .string({ required_error: 'Informe o valor.' })
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: 'Informe um valor positivo.',
    }),

  vencimento: z
    .string({ required_error: 'Informe a data de vencimento.' })
    .refine((v) => !isNaN(Date.parse(v)), {
      message: 'Data de vencimento inválida.',
    }),

  mesReferencia: z
    .string({ required_error: 'Selecione o mês de referência.' })
    .regex(/^\d{4}-\d{2}$/, { message: 'Formato esperado: AAAA-MM.' }),

  descricao: z.string().max(500).optional().nullable(),

  tipoPagamento: z.enum(['BOLETO', 'PIX', 'INDEFINIDO']).default('BOLETO').optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/financeiro/boletos — Lista boletos (com campos Asaas)
// =============================================================================

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const url     = new URL(req.url);
    const page    = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1',  10));
    const limit   = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
    const status  = url.searchParams.get('status')   ?? undefined;
    const clienteId = url.searchParams.get('clienteId') ?? undefined;

    let role     = auth.role;
    const vinculo    = auth.vinculo;
    const superiorId = auth.superiorId;

    if (role === 'EMPLOYEE' && vinculo === 'ESCRITORIO' && superiorId) role = 'ACCOUNTANT';
    else if (role === 'EMPLOYEE' && vinculo === 'CLIENTE'  && superiorId) role = 'CLIENT';

    const where: Record<string, unknown> = {};

    if (role === 'ACCOUNTANT' || role === 'ADMIN') {
      const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
      where.escritorioId = contadorId;
      if (clienteId) where.clienteId = clienteId;
    } else if (role === 'CLIENT') {
      where.clienteId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
    } else {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    if (status) where.status = status;

    const [boletos, total] = await Promise.all([
      prisma.boletoHonorario.findMany({
        where,
        orderBy: { vencimento: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: { cliente: { select: { id: true, name: true, cnpj: true } } },
      }),
      prisma.boletoHonorario.count({ where }),
    ]);

    return NextResponse.json({
      boletos: boletos.map((b) => ({
        id:               b.id,
        clienteId:        b.clienteId,
        clienteNome:      b.cliente.name,
        clienteCnpj:      b.cliente.cnpj,
        valor:            Number(b.valor),
        vencimento:       b.vencimento.toISOString(),
        status:           b.status,
        mesReferencia:    b.mesReferencia,
        fileName:         b.fileName,
        fileSizeBytes:    b.fileSizeBytes ? Number(b.fileSizeBytes) : null,
        descricao:        b.descricao,
        // Asaas
        asaasId:           b.asaasId,
        asaasBoletoUrl:    b.asaasBoletoUrl,
        asaasBarcode:      b.asaasBarcode,
        asaasPixCopiaECola: b.asaasPixCopiaECola,
        // Cora
        coraId:            b.coraId,
        coraBoletoUrl:     b.coraBoletoUrl,
        coraBarcode:       b.coraBarcode,
        coraPixPayload:    b.coraPixPayload,
        // Qual provedor emitiu
        provider: b.asaasId ? 'asaas' : b.coraId ? 'cora' : 'local',
        createdAt:         b.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error('[GET /financeiro/boletos] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'CLIENT', 'EMPLOYEE']);

// =============================================================================
// POST /api/v1/financeiro/boletos — Gera novo boleto
//
// Fluxo:
//   1. Valida input e verifica vínculo contador↔cliente
//   2. Se asaasApiKey configurada → emite via Asaas (boleto real)
//   3. Caso contrário → gera PDF local (fallback MVP)
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  try {
    if (auth.role !== 'ACCOUNTANT' && auth.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'Apenas o dono do escritório pode gerar boletos.' },
        { status: 403 },
      );
    }

    const parsed = CriarBoletoSchema.safeParse(await req.json());
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (key && !fields[key]) fields[key] = issue.message;
      }
      return NextResponse.json({ error: 'Erro de validação.', fields }, { status: 400 });
    }

    const { clienteId, valor, vencimento, mesReferencia, descricao, tipoPagamento } = parsed.data;
    const valorNum = parseFloat(valor);

    // Verifica vínculo contador↔cliente (IDOR protection)
    const vinculo = await prisma.contadorCliente.findFirst({
      where:   { contadorId: auth.sub, clienteId },
      include: { cliente: { select: { name: true, cnpj: true, email: true, notifEmailBoleto: true } } },
    });
    if (!vinculo) {
      return NextResponse.json({ message: 'Cliente não pertence à sua carteira.' }, { status: 403 });
    }

    // Busca configuração do escritório (Asaas + Cora)
    const config = await prisma.configuracaoEscritorio.findUnique({
      where:  { contadorId: auth.sub },
      select: {
        nomeEscritorio:    true,
        asaasApiKey:       true,
        coraClientId:      true,
        coraCertificatePem: true,
        coraPrivateKeyPem:  true,
      },
    });

    const vencimentoDate = new Date(vencimento);
    const boletoIdTemp   = crypto.randomUUID();

    // =========================================================================
    // Caminho A: Asaas configurado → emite boleto real
    // =========================================================================
    if (config?.asaasApiKey) {
      const svc = new AsaasService(config.asaasApiKey);

      const customerId = await svc.criarOuBuscarCliente(
        vinculo.cliente.cnpj ?? '',
        vinculo.cliente.name,
        vinculo.cliente.email ?? undefined,
      );

      // Formata data YYYY-MM-DD
      const vencStr = vencimentoDate.toISOString().split('T')[0];

      const billingType = (tipoPagamento === 'INDEFINIDO' ? 'UNDEFINED' : (tipoPagamento ?? 'BOLETO')) as 'BOLETO' | 'PIX' | 'UNDEFINED';

      const payment = await svc.criarBoleto({
        customerId,
        valor:             valorNum,
        vencimento:        vencStr,
        descricao:         descricao ?? `Honorários ${mesReferencia}`,
        externalReference: boletoIdTemp,
        billingType,
      });

      // Busca barcode apenas para boleto; PIX apenas para pagamento PIX
      const fetchBarcode = billingType !== 'PIX';
      const fetchPix     = billingType !== 'BOLETO';

      const [barcode, pix] = await Promise.all([
        fetchBarcode ? svc.buscarLinhaDigitavel(payment.id) : Promise.resolve(null),
        fetchPix     ? svc.buscarPixQrCode(payment.id)      : Promise.resolve(null),
      ]);

      const boleto = await prisma.boletoHonorario.create({
        data: {
          id:                boletoIdTemp,
          clienteId,
          escritorioId:      auth.sub,
          valor:             valorNum,
          vencimento:        vencimentoDate,
          mesReferencia,
          descricao:         descricao || null,
          asaasId:           payment.id,
          asaasBoletoUrl:    payment.invoiceUrl ?? payment.bankSlipUrl,
          asaasBarcode:      barcode,
          asaasPixCopiaECola: pix,
          tipoPagamento:     tipoPagamento ?? 'BOLETO',
        },
        include: { cliente: { select: { id: true, name: true } } },
      });

      await _publicarNotificacao(boleto);

      if (vinculo.cliente.notifEmailBoleto && vinculo.cliente.email) {
        _enviarEmailNovoBoleto({
          emailCliente:   vinculo.cliente.email,
          nomeCliente:    vinculo.cliente.name,
          nomeEscritorio: config?.nomeEscritorio ?? 'Seu Escritório',
          valor:          valorNum,
          vencimento:     vencimentoDate,
          mesReferencia,
          descricao,
          urlPortal:      process.env.NEXT_PUBLIC_APP_URL ?? '',
        });
      }

      return NextResponse.json({
        boleto: {
          id:              boleto.id,
          clienteId:       boleto.clienteId,
          clienteNome:     boleto.cliente.name,
          valor:           Number(boleto.valor),
          vencimento:      boleto.vencimento.toISOString(),
          status:          boleto.status,
          mesReferencia:   boleto.mesReferencia,
          descricao:       boleto.descricao,
          asaasId:         boleto.asaasId,
          asaasBoletoUrl:  boleto.asaasBoletoUrl,
          asaasBarcode:    boleto.asaasBarcode,
          asaasPixCopiaECola: boleto.asaasPixCopiaECola,
          provider:        'asaas',
        },
      }, { status: 201 });
    }

    // =========================================================================
    // Caminho B: Cora configurado → emite boleto real via Cora
    // =========================================================================
    if (config?.coraClientId && config.coraCertificatePem && config.coraPrivateKeyPem) {
      const cora = new CoraService(
        config.coraClientId,
        config.coraCertificatePem,
        config.coraPrivateKeyPem,
      );

      const vencStr = vencimentoDate.toISOString().split('T')[0];
      const comPix  = tipoPagamento === 'PIX' || tipoPagamento === 'INDEFINIDO';

      const invoice = await cora.criarInvoice({
        clienteNome:       vinculo.cliente.name,
        clienteCnpjCpf:    vinculo.cliente.cnpj ?? '',
        clienteEmail:      vinculo.cliente.email ?? '',
        valor:             valorNum,
        vencimento:        vencStr,
        descricao:         descricao ?? `Honorários ${mesReferencia}`,
        externalReference: boletoIdTemp,
        comPix,
      });

      const boleto = await prisma.boletoHonorario.create({
        data: {
          id:            boletoIdTemp,
          clienteId,
          escritorioId:  auth.sub,
          valor:         valorNum,
          vencimento:    vencimentoDate,
          mesReferencia,
          descricao:     descricao || null,
          coraId:        invoice.id,
          coraBarcode:   invoice.barcode,
          coraBoletoUrl: invoice.boleto_url,
          coraPixPayload: invoice.pix?.qr_code ?? null,
          tipoPagamento:  tipoPagamento ?? 'BOLETO',
        },
        include: { cliente: { select: { id: true, name: true } } },
      });

      await _publicarNotificacao(boleto);

      if (vinculo.cliente.notifEmailBoleto && vinculo.cliente.email) {
        _enviarEmailNovoBoleto({
          emailCliente:   vinculo.cliente.email,
          nomeCliente:    vinculo.cliente.name,
          nomeEscritorio: config?.nomeEscritorio ?? 'Seu Escritório',
          valor:          valorNum,
          vencimento:     vencimentoDate,
          mesReferencia,
          descricao,
          urlPortal:      process.env.NEXT_PUBLIC_APP_URL ?? '',
        });
      }

      return NextResponse.json({
        boleto: {
          id:            boleto.id,
          clienteId:     boleto.clienteId,
          clienteNome:   boleto.cliente.name,
          valor:         Number(boleto.valor),
          vencimento:    boleto.vencimento.toISOString(),
          status:        boleto.status,
          mesReferencia: boleto.mesReferencia,
          descricao:     boleto.descricao,
          coraId:        boleto.coraId,
          coraBoletoUrl: boleto.coraBoletoUrl,
          coraBarcode:   boleto.coraBarcode,
          coraPixPayload: boleto.coraPixPayload,
          provider:      'cora',
        },
      }, { status: 201 });
    }

    // =========================================================================
    // Caminho C: Sem integração → gera PDF local (fallback)
    // =========================================================================
    const pdfBuffer = await gerarBoletoPdf({
      nomeEscritorio: config?.nomeEscritorio ?? 'Escritório Contábil',
      clienteNome:    vinculo.cliente.name,
      clienteCnpj:    vinculo.cliente.cnpj ?? '',
      valor:          valorNum,
      vencimento:     vencimentoDate,
      mesReferencia,
      descricao,
      boletoId:       boletoIdTemp,
    });

    const fileName    = `boleto_${mesReferencia}_${Date.now()}.pdf`;
    const storagePath = `financeiro/boletos/${auth.sub}/${clienteId}/${fileName}`;
    await storageService.upload(storagePath, pdfBuffer, 'application/pdf');

    const boleto = await prisma.boletoHonorario.create({
      data: {
        id:            boletoIdTemp,
        clienteId,
        escritorioId:  auth.sub,
        valor:         valorNum,
        vencimento:    vencimentoDate,
        mesReferencia,
        storagePath,
        fileName,
        fileSizeBytes: BigInt(pdfBuffer.byteLength),
        descricao:     descricao || null,
      },
      include: { cliente: { select: { id: true, name: true } } },
    });

    await _publicarNotificacao(boleto);

    if (vinculo.cliente.notifEmailBoleto && vinculo.cliente.email) {
      _enviarEmailNovoBoleto({
        emailCliente:   vinculo.cliente.email,
        nomeCliente:    vinculo.cliente.name,
        nomeEscritorio: config?.nomeEscritorio ?? 'Seu Escritório',
        valor:          valorNum,
        vencimento:     vencimentoDate,
        mesReferencia,
        descricao,
        urlPortal:      process.env.NEXT_PUBLIC_APP_URL ?? '',
      });
    }

    return NextResponse.json({
      boleto: {
        id:            boleto.id,
        clienteId:     boleto.clienteId,
        clienteNome:   boleto.cliente.name,
        valor:         Number(boleto.valor),
        vencimento:    boleto.vencimento.toISOString(),
        status:        boleto.status,
        mesReferencia: boleto.mesReferencia,
        fileName:      boleto.fileName,
        descricao:     boleto.descricao,
        provider:      'local',
      },
    }, { status: 201 });
  } catch (err) {
    logger.error('[POST /financeiro/boletos] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// Helper interno — envia email de novo boleto ao cliente
// =============================================================================

function _enviarEmailNovoBoleto(params: {
  emailCliente:   string;
  nomeCliente:    string;
  nomeEscritorio: string;
  valor:          number;
  vencimento:     Date;
  mesReferencia:  string;
  descricao:      string | null | undefined;
  urlPortal:      string;
}) {
  const valorFmt    = `R$ ${params.valor.toFixed(2).replace('.', ',')}`;
  const vencFmt     = params.vencimento.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const html = emailWrapper(
    emailSubheading('Novo Boleto Disponível') +
    emailHeading('Você tem um boleto para pagar') +
    emailText(`Olá, <strong>${params.nomeCliente}</strong>! ${params.nomeEscritorio} emitiu um novo boleto de honorários para você.`) +
    emailInfoBox([
      { label: 'Referência',  value: params.mesReferencia },
      { label: 'Valor',       value: valorFmt },
      { label: 'Vencimento',  value: vencFmt },
      ...(params.descricao ? [{ label: 'Descrição', value: params.descricao }] : []),
    ]) +
    emailCallout('Acesse o portal para visualizar o boleto, código de barras e opções de pagamento via Pix.', '💳') +
    emailButton('Pagar Agora', params.urlPortal),
  );

  emailService.enviar({
    destinatario: params.emailCliente,
    assunto:      `Novo boleto de honorários — ${params.mesReferencia} (${valorFmt})`,
    corpoHtml:    html,
  }).catch(() => {});
}

// =============================================================================
// Helper interno — publica evento Redis para notificação WebSocket
// =============================================================================

async function _publicarNotificacao(boleto: {
  id: string;
  clienteId: string;
  mesReferencia: string;
  valor: unknown;
  vencimento: Date;
}) {
  try {
    const { redisPublisher } = await import('../../../../../src/infrastructure/di/Container');
    await redisPublisher.publish('domain_events', JSON.stringify({
      eventName: 'NovoBoletoHonorarioEvent',
      payload: {
        boletoId:      boleto.id,
        clienteId:     boleto.clienteId,
        mesReferencia: boleto.mesReferencia,
        valor:         Number(boleto.valor),
        vencimento:    boleto.vencimento.toISOString(),
        mensagem: `Seu boleto de honorários de ${boleto.mesReferencia} (R$ ${Number(boleto.valor).toFixed(2)}) já está disponível.`,
      },
    }));
  } catch { /* não bloqueia */ }
}
