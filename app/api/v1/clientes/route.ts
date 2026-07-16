import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

import { withAuth }     from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, emailService } from '../../../../src/infrastructure/di/Container';
import { logger }        from '../../../../src/utils/logger';
import { checkClienteLimit } from '../../../../src/utils/planLimits';
import { checkRateLimit } from '../../../../src/utils/rateLimiter';
import { criarClienteSchema } from '../../../../src/infrastructure/http/validators/CriarClienteSchema';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Invite token – 48h de validade
// =============================================================================

const INVITE_EXPIRY_HOURS = 48;

// =============================================================================
// GET /api/v1/clientes
//
// Retorna a lista de clientes atrelados ao Contador logado via tabela de
// junção ContadorCliente.
//
// Query params:
//   search  → filtro parcial por nome ou CNPJ (opcional)
//   page    → inteiro >= 1 (padrão: 1)
//   perPage → inteiro 1–100 (padrão: 20); use perPage=0 para retornar todos
//             (útil para selects de upload — sem paginação)
//
// Respostas:
//   200 OK → { clientes, total, page, perPage, totalPages, hasNextPage, hasPreviousPage }
// =============================================================================

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search')?.trim() ?? '';

    const pageRaw    = parseInt(searchParams.get('page')    ?? '1',  10);
    const perPageRaw = parseInt(searchParams.get('perPage') ?? '20', 10);
    const all        = perPageRaw === 0; // sem paginação
    const page       = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
    const perPage    = all ? 0 : (Number.isFinite(perPageRaw) && perPageRaw >= 1 && perPageRaw <= 100 ? perPageRaw : 20);

    const whereCliente = {
      deletedAt: null as null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { cnpj: { contains: search } },
            ],
          }
        : {}),
    };

    const [total, relacoes] = await Promise.all([
      prisma.contadorCliente.count({
        where: { contadorId, cliente: whereCliente },
      }),
      prisma.contadorCliente.findMany({
        where: { contadorId, cliente: whereCliente },
        select: {
          assignedAt: true,
          cliente: {
            select: {
              id:               true,
              name:             true,
              email:            true,
              cnpj:             true,
              phone:            true,
              avatarUrl:        true,
              isActive:         true,
              activatedAt:      true,
              inviteToken:      true,
              createdAt:        true,
              cnae:             true,
              regimeTributario: true,
            },
          },
        },
        orderBy: { cliente: { name: 'asc' } },
        ...(all ? {} : { skip: (page - 1) * perPage, take: perPage }),
      }),
    ]);

    const totalPages = all ? 1 : Math.ceil(total / perPage) || 1;

    const clientes = relacoes.map((r) => ({
      id:               r.cliente.id,
      nome:             r.cliente.name,
      email:            r.cliente.email,
      cnpj:             r.cliente.cnpj,
      phone:            r.cliente.phone,
      avatarUrl:        r.cliente.avatarUrl,
      isActive:         r.cliente.isActive,
      activatedAt:      r.cliente.activatedAt?.toISOString() ?? null,
      convitePendente:  !r.cliente.isActive && !!r.cliente.inviteToken,
      assignedAt:       r.assignedAt.toISOString(),
      createdAt:        r.cliente.createdAt.toISOString(),
      cnae:             r.cliente.cnae,
      regimeTributario: r.cliente.regimeTributario,
    }));

    return NextResponse.json({
      clientes,
      total,
      page:            all ? 1 : page,
      perPage:         all ? total : perPage,
      totalPages,
      hasPreviousPage: !all && page > 1,
      hasNextPage:     !all && page < totalPages,
    });
  } catch (err) {
    logger.error('[GET /clientes] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);

// =============================================================================
// POST /api/v1/clientes
//
// Cria um novo UsuarioCliente com convite (sem senha) e vincula ao Contador.
// Gera um inviteToken que será enviado por e-mail para ativação da conta.
//
// Body (JSON):
//   { nome: string, email: string, cnpj: string, phone?: string }
//
// Respostas:
//   201 Created           → { cliente, inviteLink }
//   400 Bad Request       → validação falhou
//   409 Conflict          → e-mail ou CNPJ já cadastrado
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  const rl = await checkRateLimit(`write:clientes:${auth.sub}`, 30, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas requisições. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: 'Corpo da requisição deve ser JSON válido.' },
      { status: 400 },
    );
  }

  const parsed = criarClienteSchema.safeParse(body);
  if (!parsed.success) {
    const erros = parsed.error.errors.map((e) => e.message);
    return NextResponse.json({ message: 'Validação falhou.', erros }, { status: 400 });
  }

  const { nome, email, cnpj, phone, cnae, regimeTributario } = parsed.data;

  try {
    // Verifica limite de clientes do plano
    const limite = await checkClienteLimit(auth.sub);
    if (!limite.allowed) {
      return NextResponse.json(
        { message: `Limite de clientes atingido (${limite.current}/${limite.limit}). Faça upgrade do seu plano para adicionar mais clientes.` },
        { status: 403 },
      );
    }

    // Verifica duplicidade de e-mail ou CNPJ em registros ativos
    const ativo = await prisma.usuarioCliente.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: email.toLowerCase() },
          { cnpj },
        ],
      },
      select: { email: true, cnpj: true },
    });

    if (ativo) {
      const campo = ativo.email === email.toLowerCase() ? 'E-mail' : 'CNPJ';
      return NextResponse.json(
        { message: `${campo} já cadastrado no sistema.` },
        { status: 409 },
      );
    }

    // Gerar invite token seguro
    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    // Verifica se há registro soft-deleted com mesmo CNPJ ou e-mail → restaurar
    const softDeleted = await prisma.usuarioCliente.findFirst({
      where: {
        deletedAt: { not: null },
        OR: [
          { email: email.toLowerCase() },
          { cnpj },
        ],
      },
      select: { id: true },
    });

    // Cria ou restaura cliente + vinculação na mesma transação
    const cliente = await prisma.$transaction(async (tx) => {
      let clienteData: {
        id: string; name: string; email: string; cnpj: string | null;
        phone: string | null; avatarUrl: string | null; isActive: boolean; createdAt: Date;
      };

      if (softDeleted) {
        // Restaura o registro soft-deleted com os novos dados
        clienteData = await tx.usuarioCliente.update({
          where: { id: softDeleted.id },
          data: {
            name:             nome,
            email:            email.toLowerCase(),
            cnpj,
            phone:            phone ?? null,
            cnae:             cnae ?? null,
            regimeTributario: regimeTributario ?? null,
            isActive:         false,
            deletedAt:        null,
            inviteToken,
            inviteExpiresAt,
          },
          select: { id: true, name: true, email: true, cnpj: true, phone: true, avatarUrl: true, isActive: true, createdAt: true },
        });

        // Garante o vínculo com o contador (pode não existir ou pertencer a outro)
        await tx.contadorCliente.upsert({
          where: { contadorId_clienteId: { contadorId: auth.sub, clienteId: softDeleted.id } },
          update: {},
          create: { contadorId: auth.sub, clienteId: softDeleted.id },
        });
      } else {
        // Criação normal
        const novoCliente = await tx.usuarioCliente.create({
          data: {
            name:             nome,
            email:            email.toLowerCase(),
            cnpj,
            phone:            phone ?? null,
            cnae:             cnae ?? null,
            regimeTributario: regimeTributario ?? null,
            inviteToken,
            inviteExpiresAt,
          },
        });

        await tx.contadorCliente.create({
          data: { contadorId: auth.sub, clienteId: novoCliente.id },
        });

        clienteData = novoCliente;
      }

      return clienteData;
    });

    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/auth/ativar-conta?token=${inviteToken}`;
    try {
      await emailService.enviarConviteCliente({ email: email.toLowerCase(), nome, link: inviteLink });
    } catch (emailErr) {
      logger.error('[POST /clientes] Falha ao enviar e-mail de convite.', emailErr instanceof Error ? emailErr : undefined);
    }

    return NextResponse.json(
      {
        cliente: {
          id:        cliente.id,
          nome:      cliente.name,
          email:     cliente.email,
          cnpj:      cliente.cnpj,
          phone:     cliente.phone,
          avatarUrl: cliente.avatarUrl,
          isActive:  cliente.isActive,
          createdAt: cliente.createdAt.toISOString(),
        },
        inviteLink,
      },
      { status: 201 },
    );
  } catch (err) {
    // P2002 = unique constraint violation (race condition ou CNPJ/e-mail duplicado)
    if (
      err instanceof Error &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { message: 'CNPJ ou e-mail já cadastrado no sistema.' },
        { status: 409 },
      );
    }
    logger.error('[POST /clientes] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN']);
