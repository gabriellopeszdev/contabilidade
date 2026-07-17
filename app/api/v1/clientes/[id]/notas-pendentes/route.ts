import { NextRequest, NextResponse }                                           from 'next/server';
import { withAuth, type ResolvedRouteContext }                                  from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                                                               from '../../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/clientes/[id]/notas-pendentes?status=PENDENTE
// Lista as notas fiscais da SEFAZ pendentes de revisão para um cliente.
export const GET = withAuth(async (req: NextRequest, ctx, auth) => {
  const { id: clienteId } = (ctx as ResolvedRouteContext).params;

  const vinculo = await prisma.contadorCliente.findUnique({
    where: { contadorId_clienteId: { contadorId: auth.sub, clienteId } },
    select: { clienteId: true },
  });
  if (!vinculo) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });

  const status = req.nextUrl.searchParams.get('status') ?? 'PENDENTE';

  const notas = await prisma.notaPendenteSefaz.findMany({
    where:   { clienteId, status: status as never },
    orderBy: { createdAt: 'desc' },
    select: {
      id:           true,
      chaveAcesso:  true,
      nsu:          true,
      status:       true,
      emitenteCnpj: true,
      emitenteNome: true,
      numero:       true,
      serie:        true,
      dataEmissao:  true,
      valorTotal:   true,
      revisadoEm:   true,
      documentoId:  true,
      createdAt:    true,
    },
  });

  return NextResponse.json({ notas });
}, ['ACCOUNTANT']);
