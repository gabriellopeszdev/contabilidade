import { NextResponse } from 'next/server';
import { z }            from 'zod';
import { withAuth }     from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }       from '../../../../../src/infrastructure/di/Container';
import { AsaasService } from '../../../../../src/infrastructure/asaas/AsaasService';
import { logger }       from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CriarAssinaturaSchema = z.object({
  clienteId:     z.string().uuid(),
  valor:         z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0),
  nextDueDate:   z.string().refine((v) => !isNaN(Date.parse(v))),
  ciclo:         z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUALLY', 'YEARLY']),
  tipoPagamento: z.enum(['BOLETO', 'PIX', 'INDEFINIDO']).default('BOLETO'),
  descricao:     z.string().max(500).optional().nullable(),
});

// GET /api/v1/financeiro/assinaturas — Lista assinaturas do escritório
export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    let role      = auth.role;
    let contadorId = auth.sub;
    if (role === 'EMPLOYEE' && auth.vinculo === 'ESCRITORIO' && auth.superiorId) {
      role = 'ACCOUNTANT';
      contadorId = auth.superiorId;
    } else if (role === 'EMPLOYEE' && auth.vinculo === 'CLIENTE' && auth.superiorId) {
      role = 'CLIENT';
    }

    const url      = new URL(req.url);
    const clienteId = url.searchParams.get('clienteId') ?? undefined;

    const where: Record<string, unknown> = {};
    if (role === 'ACCOUNTANT' || role === 'ADMIN') {
      where.escritorioId = contadorId;
      if (clienteId) where.clienteId = clienteId;
    } else if (role === 'CLIENT') {
      where.clienteId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
    } else {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    const assinaturas = await prisma.assinaturaHonorario.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { cliente: { select: { id: true, name: true, cnpj: true } } },
    });

    return NextResponse.json({
      assinaturas: assinaturas.map((a) => ({
        id:               a.id,
        clienteId:        a.clienteId,
        clienteNome:      a.cliente.name,
        clienteCnpj:      a.cliente.cnpj,
        valor:            Number(a.valor),
        ciclo:            a.ciclo,
        tipoPagamento:    a.tipoPagamento,
        descricao:        a.descricao,
        asaasId:          a.asaasId,
        asaasStatus:      a.asaasStatus,
        proximoVencimento: a.proximoVencimento?.toISOString() ?? null,
        createdAt:        a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error('[GET /financeiro/assinaturas]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN', 'CLIENT', 'EMPLOYEE']);

// POST /api/v1/financeiro/assinaturas — Cria assinatura recorrente
export const POST = withAuth(async (req, _ctx, auth) => {
  try {
    if (auth.role !== 'ACCOUNTANT' && auth.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Apenas o dono do escritório pode criar assinaturas.' }, { status: 403 });
    }

    const parsed = CriarAssinaturaSchema.safeParse(await req.json());
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (key && !fields[key]) fields[key] = issue.message;
      }
      return NextResponse.json({ error: 'Erro de validação.', fields }, { status: 400 });
    }

    const { clienteId, valor, nextDueDate, ciclo, tipoPagamento, descricao } = parsed.data;
    const valorNum = parseFloat(valor);

    const vinculo = await prisma.contadorCliente.findFirst({
      where:   { contadorId: auth.sub, clienteId },
      include: { cliente: { select: { name: true, cnpj: true, email: true } } },
    });
    if (!vinculo) {
      return NextResponse.json({ message: 'Cliente não pertence à sua carteira.' }, { status: 403 });
    }

    const config = await prisma.configuracaoEscritorio.findUnique({
      where:  { contadorId: auth.sub },
      select: { asaasApiKey: true },
    });
    if (!config?.asaasApiKey) {
      return NextResponse.json({ message: 'Configure a integração Asaas antes de criar assinaturas recorrentes.' }, { status: 400 });
    }

    const svc        = new AsaasService(config.asaasApiKey);
    const customerId = await svc.criarOuBuscarCliente(
      vinculo.cliente.cnpj ?? '',
      vinculo.cliente.name,
      vinculo.cliente.email ?? undefined,
    );

    const assinaturaId = crypto.randomUUID();
    const billingType  = tipoPagamento === 'INDEFINIDO' ? 'UNDEFINED' : tipoPagamento;

    const asaasAssinatura = await svc.criarAssinatura({
      customerId,
      valor:             valorNum,
      nextDueDate:       new Date(nextDueDate).toISOString().split('T')[0],
      cycle:             ciclo,
      descricao:         descricao ?? `Honorários recorrentes`,
      externalReference: assinaturaId,
      billingType:       billingType as 'BOLETO' | 'PIX' | 'UNDEFINED',
    });

    const assinatura = await prisma.assinaturaHonorario.create({
      data: {
        id:               assinaturaId,
        clienteId,
        escritorioId:     auth.sub,
        valor:            valorNum,
        ciclo,
        tipoPagamento,
        descricao:        descricao || null,
        asaasId:          asaasAssinatura.id,
        asaasStatus:      asaasAssinatura.status,
        proximoVencimento: asaasAssinatura.nextDueDate ? new Date(asaasAssinatura.nextDueDate) : null,
      },
      include: { cliente: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      assinatura: {
        id:               assinatura.id,
        clienteId:        assinatura.clienteId,
        clienteNome:      assinatura.cliente.name,
        valor:            Number(assinatura.valor),
        ciclo:            assinatura.ciclo,
        tipoPagamento:    assinatura.tipoPagamento,
        asaasId:          assinatura.asaasId,
        asaasStatus:      assinatura.asaasStatus,
        proximoVencimento: assinatura.proximoVencimento?.toISOString() ?? null,
      },
    }, { status: 201 });
  } catch (err) {
    logger.error('[POST /financeiro/assinaturas]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
