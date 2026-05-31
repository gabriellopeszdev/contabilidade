import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';
import { logger } from '@/utils/logger';
import type { RouteContext } from '@/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({
  planoId:       z.string().uuid('planoId inválido.'),
  status:        z.enum(['TRIAL', 'ATIVO', 'INADIMPLENTE', 'SUSPENSO', 'CANCELADO']),
  dataRenovacao: z.string().datetime().optional(),
});

// PUT /api/v1/admin/contadores/[id]/plano
// Cria ou atualiza a assinatura de um contador (acesso superadmin).
export const PUT = withAuth(async (req, ctx: RouteContext, _auth) => {
  const { id } = ctx.params as { id: string };

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ message: 'Body deve ser JSON válido.' }, { status: 400 });
  }

  const parse = Schema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ message: 'Dados inválidos.', erros: parse.error.errors.map((e) => e.message) }, { status: 422 });
  }

  const { planoId, status, dataRenovacao } = parse.data;

  try {
    const [contador, plano] = await Promise.all([
      prisma.usuarioContador.findUnique({ where: { id } }),
      prisma.planoSaaS.findUnique({ where: { id: planoId } }),
    ]);

    if (!contador) return NextResponse.json({ message: 'Contador não encontrado.' }, { status: 404 });
    if (!plano)    return NextResponse.json({ message: 'Plano não encontrado.'    }, { status: 404 });

    const renovacao = dataRenovacao
      ? new Date(dataRenovacao)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.assinaturaSaaS.upsert({
      where:  { escritorioId: id },
      update: { planoId, status, dataRenovacao: renovacao, valorMensal: plano.preco },
      create: { escritorioId: id, planoId, status, dataRenovacao: renovacao, valorMensal: plano.preco },
    });

    logger.info('[PUT /admin/contadores/[id]/plano] Assinatura atualizada.', { contadorId: id, planoId, status });

    return NextResponse.json({ ok: true, planoNome: plano.nome, status });
  } catch (err) {
    logger.error('[PUT /admin/contadores/[id]/plano] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
