import { NextRequest, NextResponse } from 'next/server';
import { z }         from 'zod';
import { withAuth }  from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }    from '../../../../../../src/infrastructure/di/Container';
import { logger }    from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Validação CNPJ (inline)
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

const EditarClienteSchema = z.object({
  name:               z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(255),
  email:              z.string().email('E-mail inválido.').toLowerCase(),
  cnpj:               z.string()
                          .transform((v) => v.replace(/\D/g, ''))
                          .refine((v) => v.length === 14, 'CNPJ deve conter 14 dígitos.')
                          .refine(cnpjValido, 'CNPJ inválido.'),
  isActive:           z.boolean(),
  providerAssinatura: z.enum(['INTERNO', 'DOCSEAL', 'SIGNATUREAPI']),
});

// =============================================================================
// PUT /api/v1/admin/clientes/:id — Atualiza dados do cliente (Super Admin)
// =============================================================================
export const PUT = withAuth(async (req: NextRequest, ctx) => {
  try {
    const { id } = await Promise.resolve(ctx.params as { id: string });

    const cliente = await prisma.usuarioCliente.findFirst({
      where: { id, deletedAt: null },
    });
    if (!cliente) {
      return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: 'Body inválido.' }, { status: 400 });
    }

    const parse = EditarClienteSchema.safeParse(body);
    if (!parse.success) {
      const fields: Record<string, string> = {};
      for (const issue of parse.error.issues) {
        const key = issue.path[0] as string;
        if (key && !fields[key]) fields[key] = issue.message;
      }
      return NextResponse.json({ message: 'Dados inválidos.', fields }, { status: 422 });
    }

    const { name, email, cnpj, isActive, providerAssinatura } = parse.data;

    // Unicidade: e-mail e CNPJ não podem pertencer a outro cliente ativo
    const [emailConflito, cnpjConflito] = await Promise.all([
      prisma.usuarioCliente.findFirst({ where: { email, deletedAt: null, NOT: { id } } }),
      prisma.usuarioCliente.findFirst({ where: { cnpj, deletedAt: null, NOT: { id } } }),
    ]);

    if (emailConflito) {
      return NextResponse.json({
        message: 'E-mail já usado por outro cliente.',
        fields: { email: 'E-mail já cadastrado.' }
      }, { status: 409 });
    }
    if (cnpjConflito) {
      return NextResponse.json({
        message: 'CNPJ já usado por outro cliente.',
        fields: { cnpj: 'CNPJ já cadastrado.' }
      }, { status: 409 });
    }

    // Atualização
    const atualizado = await prisma.usuarioCliente.update({
      where: { id },
      data: {
        name,
        email,
        cnpj,
        isActive,
        providerAssinatura,
      },
    });

    logger.info('[PUT /admin/clientes/:id] Dados atualizados pelo Super Admin.', { id });

    return NextResponse.json({
      ok: true,
      cliente: {
        id:                 atualizado.id,
        name:               atualizado.name,
        email:              atualizado.email,
        cnpj:               atualizado.cnpj,
        isActive:           atualizado.isActive,
        providerAssinatura: atualizado.providerAssinatura,
      }
    });
  } catch (err) {
    logger.error('[PUT /admin/clientes/:id]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ADMIN']);
