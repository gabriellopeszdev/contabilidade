import { NextRequest, NextResponse } from 'next/server';
import { z }         from 'zod';
import { withAuth }  from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }    from '../../../../../../src/infrastructure/di/Container';
import { logger }    from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EditarContadorSchema = z.object({
  name:           z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(255),
  email:          z.string().email('E-mail inválido.').toLowerCase(),
  crc:            z.string().optional().or(z.literal('')),
  nomeEscritorio: z.string().min(2, 'Nome do escritório deve ter ao menos 2 caracteres.').max(255),
  cnpjEscritorio: z.string().optional().or(z.literal('')),
  providerAssinatura: z.enum(['INTERNO', 'ZAPSIGN']),
}).superRefine((data, ctx) => {
  const hasCrc = data.crc && data.crc.trim();
  const hasCnpj = data.cnpjEscritorio && data.cnpjEscritorio.trim();

  if (!hasCrc && !hasCnpj) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['crc'],
      message: 'É necessário informar ao menos o CRC ou o CNPJ do escritório.',
    });
  }

  if (hasCrc && !/^CRC-[A-Z]{2}\/\d{1,9}$/i.test(data.crc!)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['crc'],
      message: 'CRC deve estar no formato CRC-UF/NUMERO (ex: CRC-SP/123456).',
    });
  }

  if (hasCnpj && data.cnpjEscritorio!.replace(/\D/g, '').length !== 14) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cnpjEscritorio'],
      message: 'CNPJ do escritório deve ter exatamente 14 dígitos.',
    });
  }
});

// =============================================================================
// PUT /api/v1/admin/contadores/:id — Atualiza dados do contador
// =============================================================================

export const PUT = withAuth(async (req: NextRequest, ctx) => {
  try {
    const { id } = await Promise.resolve(ctx.params as { id: string });

    const contador = await prisma.usuarioContador.findFirst({
      where: { id, deletedAt: null },
    });
    if (!contador) {
      return NextResponse.json({ message: 'Contador não encontrado.' }, { status: 404 });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ message: 'Body inválido.' }, { status: 400 }); }

    const parse = EditarContadorSchema.safeParse(body);
    if (!parse.success) {
      const fields: Record<string, string> = {};
      for (const issue of parse.error.issues) {
        const key = issue.path[0] as string;
        if (key && !fields[key]) fields[key] = issue.message;
      }
      return NextResponse.json({ message: 'Dados inválidos.', fields }, { status: 422 });
    }

    const { name, email, crc, nomeEscritorio, cnpjEscritorio, providerAssinatura } = parse.data;

    const crcValue = crc && crc.trim() ? crc.trim().toUpperCase() : null;
    const cnpjValue = cnpjEscritorio && cnpjEscritorio.trim() ? cnpjEscritorio.replace(/\D/g, '') : null;

    // Unicidade: e-mail e CRC não podem pertencer a outro contador
    const [emailConflito, crcConflito] = await Promise.all([
      prisma.usuarioContador.findFirst({ where: { email, deletedAt: null, NOT: { id } } }),
      crcValue
        ? prisma.usuarioContador.findFirst({ where: { crc: crcValue, deletedAt: null, NOT: { id } } })
        : Promise.resolve(null),
    ]);
    if (emailConflito) return NextResponse.json({ message: 'E-mail já usado por outro contador.', fields: { email: 'E-mail já cadastrado.' } }, { status: 409 });
    if (crcConflito)   return NextResponse.json({ message: 'CRC já usado por outro contador.',   fields: { crc:   'CRC já cadastrado.'   } }, { status: 409 });

    // Atualização atômica
    await prisma.$transaction([
      prisma.usuarioContador.update({
        where: { id },
        data:  { name, email, crc: crcValue },
      }),
      prisma.configuracaoEscritorio.upsert({
        where:  { contadorId: id },
        update: { nomeEscritorio, cnpjEscritorio: cnpjValue, providerAssinatura },
        create: { contadorId: id, nomeEscritorio, cnpjEscritorio: cnpjValue, providerAssinatura },
      }),
    ]);

    logger.info('[PUT /admin/contadores/:id] Dados atualizados.', { id });

    return NextResponse.json({ ok: true, name, email, crc: crcValue, nomeEscritorio, cnpjEscritorio: cnpjValue, providerAssinatura });
  } catch (err) {
    logger.error('[PUT /admin/contadores/:id]', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
