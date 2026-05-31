import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth, type ResolvedRouteContext } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Validação CNPJ (inline — mesmo algoritmo da Receita Federal)
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
// Schema de atualização
// =============================================================================

const atualizarClienteSchema = z.object({
  nome:             z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(255).optional(),
  email:            z.string().email('E-mail inválido.').max(255).optional(),
  cnpj:             z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 14, 'CNPJ deve conter 14 dígitos.')
    .refine(cnpjValido, 'CNPJ com dígitos verificadores inválidos.')
    .optional(),
  phone:            z.string().max(20).optional(),
  cnae:             z.string().max(10).optional(),
  regimeTributario: z.string().max(50).optional(),
});

// =============================================================================
// Helper: Verifica se o cliente pertence ao contador (prevenção IDOR)
// =============================================================================

async function clientePertenceAoContador(clienteId: string, contadorId: string): Promise<boolean> {
  const vinculo = await prisma.contadorCliente.findUnique({
    where: {
      contadorId_clienteId: {
        contadorId,
        clienteId,
      },
    },
  });
  return !!vinculo;
}

// =============================================================================
// PUT /api/v1/clientes/[id]
//
// Atualiza os dados de um cliente. Valida que o cliente pertence ao contador
// logado para prevenir IDOR (Insecure Direct Object Reference).
//
// Body (JSON):
//   { nome?: string, email?: string, cnpj?: string, phone?: string }
//
// Respostas:
//   200 OK            → { cliente }
//   400 Bad Request   → validação falhou
//   403 Forbidden     → cliente não pertence ao contador
//   404 Not Found     → cliente não encontrado
//   409 Conflict      → e-mail ou CNPJ já em uso por outro cliente
// =============================================================================

export const PUT = withAuth(async (req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: 'Corpo da requisição deve ser JSON válido.' },
      { status: 400 },
    );
  }

  const parsed = atualizarClienteSchema.safeParse(body);
  if (!parsed.success) {
    const erros = parsed.error.errors.map((e) => e.message);
    return NextResponse.json({ message: 'Validação falhou.', erros }, { status: 400 });
  }

  const { nome, email, cnpj, phone, cnae, regimeTributario } = parsed.data;

  // Verifica se ao menos um campo foi enviado
  if (!nome && !email && !cnpj && phone === undefined && cnae === undefined && regimeTributario === undefined) {
    return NextResponse.json(
      { message: 'Nenhum campo para atualizar foi enviado.' },
      { status: 400 },
    );
  }

  try {
    // Verificação IDOR: cliente pertence ao contador?
    const pertence = await clientePertenceAoContador(id, auth.sub);
    if (!pertence) {
      return NextResponse.json(
        { message: 'Cliente não encontrado ou não pertence à sua carteira.' },
        { status: 403 },
      );
    }

    // Verifica se cliente existe e não está soft-deleted
    const clienteAtual = await prisma.usuarioCliente.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, cnpj: true },
    });

    if (!clienteAtual) {
      return NextResponse.json(
        { message: 'Cliente não encontrado.' },
        { status: 404 },
      );
    }

    // Verifica duplicidade de e-mail/CNPJ se foram alterados
    if (email || cnpj) {
      const conflito = await prisma.usuarioCliente.findFirst({
        where: {
          id: { not: id },
          deletedAt: null,
          OR: [
            ...(email ? [{ email: email.toLowerCase() }] : []),
            ...(cnpj ? [{ cnpj }] : []),
          ],
        },
        select: { email: true, cnpj: true },
      });

      if (conflito) {
        const campo = email && conflito.email === email.toLowerCase() ? 'E-mail' : 'CNPJ';
        return NextResponse.json(
          { message: `${campo} já está em uso por outro cliente.` },
          { status: 409 },
        );
      }
    }

    // Atualiza
    const atualizado = await prisma.usuarioCliente.update({
      where: { id },
      data: {
        ...(nome             ? { name: nome }                           : {}),
        ...(email            ? { email: email.toLowerCase() }           : {}),
        ...(cnpj             ? { cnpj }                                 : {}),
        ...(phone !== undefined ? { phone: phone || null }              : {}),
        ...(cnae !== undefined  ? { cnae: cnae || null }                : {}),
        ...(regimeTributario !== undefined ? { regimeTributario: regimeTributario || null } : {}),
      },
    });

    return NextResponse.json({
      cliente: {
        id:        atualizado.id,
        nome:      atualizado.name,
        email:     atualizado.email,
        cnpj:      atualizado.cnpj,
        phone:     atualizado.phone,
        avatarUrl: atualizado.avatarUrl,
        isActive:  atualizado.isActive,
        createdAt: atualizado.createdAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error('[PUT /clientes/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// DELETE /api/v1/clientes/[id]
//
// Soft Delete — marca deletedAt + isActive = false.
// Valida que o cliente pertence ao contador logado (prevenção IDOR).
//
// Respostas:
//   200 OK          → { message: '...' }
//   403 Forbidden   → cliente não pertence ao contador
//   404 Not Found   → cliente não encontrado
// =============================================================================

export const DELETE = withAuth(async (_req, ctx, auth) => {
  const { id } = (ctx as ResolvedRouteContext).params;

  try {
    // Verificação IDOR
    const pertence = await clientePertenceAoContador(id, auth.sub);
    if (!pertence) {
      return NextResponse.json(
        { message: 'Cliente não encontrado ou não pertence à sua carteira.' },
        { status: 403 },
      );
    }

    const cliente = await prisma.usuarioCliente.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!cliente) {
      return NextResponse.json(
        { message: 'Cliente não encontrado.' },
        { status: 404 },
      );
    }

    // Soft Delete: marca como deletado + inativo
    await prisma.usuarioCliente.update({
      where: { id },
      data: {
        isActive:  false,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `Cliente "${cliente.name}" desativado com sucesso.`,
    });
  } catch (err) {
    logger.error('[DELETE /clientes/:id] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN']);
