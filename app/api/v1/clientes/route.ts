import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';

import { withAuth }     from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, emailService } from '../../../../src/infrastructure/di/Container';
import { logger }        from '../../../../src/utils/logger';

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
// Validação do CNPJ (algoritmo oficial da Receita Federal — inline)
// =============================================================================

function cnpjValido(digitos: string): boolean {
  if (digitos.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digitos)) return false;

  const calcDV = (parcial: string, pesos: number[]): number => {
    const soma = parcial.split('').reduce((a, d, i) => a + parseInt(d, 10) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  if (parseInt(digitos[12], 10) !== calcDV(digitos.slice(0, 12), p1)) return false;
  if (parseInt(digitos[13], 10) !== calcDV(digitos.slice(0, 13), p2)) return false;
  return true;
}

// =============================================================================
// Schema de criação de cliente
// =============================================================================

const criarClienteSchema = z.object({
  nome:  z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(255),
  email: z.string().email('E-mail inválido.').max(255),
  cnpj:  z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 14, 'CNPJ deve conter 14 dígitos.')
    .refine(cnpjValido, 'CNPJ com dígitos verificadores inválidos.'),
  phone: z.string().max(20).optional(),
});

// =============================================================================
// GET /api/v1/clientes
//
// Retorna a lista de clientes atrelados ao Contador logado via tabela de
// junção ContadorCliente. Usado pelo front-end no Select de upload de
// documentos direcionados.
//
// Query params:
//   search → filtro parcial por nome ou CNPJ (opcional)
//
// Respostas:
//   200 OK → { clientes: ClienteResumoDTO[] }
// =============================================================================

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;
    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search')?.trim() ?? '';

    const relacoes = await prisma.contadorCliente.findMany({
      where: {
        contadorId,
        cliente: {
          deletedAt: null,
          isActive:  true,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { cnpj: { contains: search } },
                ],
              }
            : {}),
        },
      },
      select: {
        assignedAt: true,
        cliente: {
          select: {
            id:        true,
            name:      true,
            email:     true,
            cnpj:      true,
            phone:     true,
            avatarUrl:   true,
            isActive:    true,
            activatedAt: true,
            createdAt:   true,
          },
        },
      },
      orderBy: { cliente: { name: 'asc' } },
    });

    const clientes = relacoes.map((r) => ({
      id:          r.cliente.id,
      nome:        r.cliente.name,
      email:       r.cliente.email,
      cnpj:        r.cliente.cnpj,
      phone:       r.cliente.phone,
      avatarUrl:   r.cliente.avatarUrl,
      isActive:    r.cliente.isActive,
      activatedAt: r.cliente.activatedAt?.toISOString() ?? null,
      assignedAt:  r.assignedAt.toISOString(),
      createdAt:   r.cliente.createdAt.toISOString(),
    }));

    return NextResponse.json({ clientes });
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

  const { nome, email, cnpj, phone } = parsed.data;

  try {
    // Verifica duplicidade de e-mail ou CNPJ
    const existente = await prisma.usuarioCliente.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { cnpj },
        ],
        deletedAt: null,
      },
      select: { email: true, cnpj: true },
    });

    if (existente) {
      const campo = existente.email === email.toLowerCase() ? 'E-mail' : 'CNPJ';
      return NextResponse.json(
        { message: `${campo} já cadastrado no sistema.` },
        { status: 409 },
      );
    }

    // Gerar invite token seguro
    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    // Cria cliente (sem senha) + vinculação na mesma transação
    const cliente = await prisma.$transaction(async (tx) => {
      const novoCliente = await tx.usuarioCliente.create({
        data: {
          name:         nome,
          email:        email.toLowerCase(),
          cnpj,
          phone:        phone ?? null,
          inviteToken,
          inviteExpiresAt,
        },
      });

      await tx.contadorCliente.create({
        data: {
          contadorId: auth.sub,
          clienteId:  novoCliente.id,
        },
      });

      return novoCliente;
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
    logger.error('[POST /clientes] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN']);
