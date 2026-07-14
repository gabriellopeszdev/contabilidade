import { NextResponse } from 'next/server';
import { withAuth }     from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService, eventDispatcher } from '../../../../src/infrastructure/di/Container';
import { NovoComunicadoEvent } from '../../../../src/domain/events/NovoComunicadoEvent';
import { logger } from '../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req, _ctx, auth) => {
  try {
    const form             = await req.formData();
    const titulo           = (form.get('titulo')           as string | null)?.trim();
    const conteudo         = (form.get('conteudo')         as string | null)?.trim();
    const exigeConfirmacao = form.get('exigeConfirmacao')  === 'true';
    const targeting        = form.get('targeting')         as string | null;
    const setor            = form.get('setor')             as string | null;
    const clienteIdsRaw    = form.getAll('clienteIds')     as string[];
    const anexo            = form.get('anexo')             as File | null;

    if (!titulo || titulo.length < 2) {
      return NextResponse.json({ message: 'Título obrigatório (mínimo 2 caracteres).' }, { status: 400 });
    }
    if (!conteudo || conteudo.length < 5) {
      return NextResponse.json({ message: 'Conteúdo obrigatório.' }, { status: 400 });
    }
    if (!['TODOS', 'SETOR', 'SELECIONADOS'].includes(targeting ?? '')) {
      return NextResponse.json({ message: 'Targeting inválido.' }, { status: 400 });
    }
    if (targeting === 'SETOR' && !['FISCAL', 'PESSOAL', 'CONTABIL'].includes(setor ?? '')) {
      return NextResponse.json({ message: 'Setor inválido para targeting SETOR.' }, { status: 400 });
    }
    if (targeting === 'SELECIONADOS' && clienteIdsRaw.length === 0) {
      return NextResponse.json({ message: 'Selecione ao menos um cliente.' }, { status: 400 });
    }

    let clienteIds: string[] = [];

    if (targeting === 'TODOS') {
      const vinculos = await prisma.contadorCliente.findMany({
        where:  { contadorId: auth.sub },
        select: { clienteId: true },
      });
      clienteIds = vinculos.map((v) => v.clienteId);
    } else if (targeting === 'SETOR') {
      const docs = await prisma.documentoFiscal.findMany({
        where: {
          sector:    setor as 'FISCAL' | 'PESSOAL' | 'CONTABIL',
          deletedAt: null,
          client: {
            contadoresRel: { some: { contadorId: auth.sub } },
            deletedAt: null,
          },
        },
        distinct: ['clientId'],
        select:   { clientId: true },
      });
      clienteIds = docs.map((d) => d.clientId);
    } else {
      const vinculos = await prisma.contadorCliente.findMany({
        where: {
          contadorId: auth.sub,
          clienteId:  { in: clienteIdsRaw },
        },
        select: { clienteId: true },
      });
      clienteIds = vinculos.map((v) => v.clienteId);
      if (clienteIds.length !== clienteIdsRaw.length) {
        return NextResponse.json(
          { message: 'Um ou mais clientes selecionados não pertencem à sua carteira.' },
          { status: 400 },
        );
      }
    }

    let anexoPath: string | null = null;
    let anexoNome: string | null = null;

    if (anexo && anexo.size > 0) {
      if (anexo.size > 50 * 1024 * 1024) {
        return NextResponse.json({ message: 'Anexo excede 50 MB.' }, { status: 400 });
      }
      const buffer    = Buffer.from(await anexo.arrayBuffer());
      const safeName  = anexo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uuid      = crypto.randomUUID();
      anexoPath       = `comunicados/${auth.sub}/${uuid}/${safeName}`;
      anexoNome       = anexo.name;
      await storageService.upload(anexoPath, buffer, anexo.type || 'application/octet-stream');
    }

    const contador = await prisma.usuarioContador.findUnique({
      where:  { id: auth.sub },
      select: { name: true },
    });

    const comunicado = await prisma.$transaction(async (tx) => {
      const c = await tx.comunicado.create({
        data: {
          contadorId:       auth.sub,
          titulo:           titulo!,
          conteudo:         conteudo!,
          exigeConfirmacao,
          targeting:        targeting!,
          setor:            targeting === 'SETOR' ? setor : null,
          ...(anexoPath ? { anexoPath, anexoNome } : {}),
        },
      });

      if (clienteIds.length > 0) {
        await tx.comunicadoDestinatario.createMany({
          data: clienteIds.map((clienteId) => ({
            comunicadoId: c.id,
            clienteId,
          })),
          skipDuplicates: true,
        });
      }

      return c;
    });

    if (clienteIds.length > 0) {
      void eventDispatcher.dispatch(
        new NovoComunicadoEvent(
          comunicado.id,
          titulo!,
          contador?.name ?? 'Seu contador',
          clienteIds,
        ),
      );
    }

    return NextResponse.json(
      { id: comunicado.id, titulo: comunicado.titulo, totalDestinatarios: clienteIds.length },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[POST /comunicados] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, parseInt(searchParams.get('page')    ?? '1',  10));
    const perPage = Math.min(50, parseInt(searchParams.get('perPage') ?? '20', 10));
    const skip    = (page - 1) * perPage;

    if (auth.role === 'ACCOUNTANT') {
      const [total, items] = await Promise.all([
        prisma.comunicado.count({ where: { contadorId: auth.sub, deletedAt: null } }),
        prisma.comunicado.findMany({
          where:   { contadorId: auth.sub, deletedAt: null },
          orderBy: { publicadoAt: 'desc' },
          skip,
          take:    perPage,
          include: {
            _count:       { select: { destinatarios: true } },
            destinatarios: { select: { lido: true, confirmado: true } },
          },
        }),
      ]);

      return NextResponse.json({
        total,
        page,
        perPage,
        items: items.map((c) => ({
          id:                 c.id,
          titulo:             c.titulo,
          targeting:          c.targeting,
          setor:              c.setor,
          exigeConfirmacao:   c.exigeConfirmacao,
          publicadoAt:        c.publicadoAt.toISOString(),
          totalDestinatarios: c._count.destinatarios,
          totalLidos:         c.destinatarios.filter((d) => d.lido).length,
          totalConfirmados:   c.destinatarios.filter((d) => d.confirmado).length,
        })),
      });
    }

    const vinculo = await prisma.contadorCliente.findFirst({
      where:  { clienteId: auth.sub },
      select: { contadorId: true, assignedAt: true },
    });

    if (!vinculo) {
      return NextResponse.json({ total: 0, page, perPage, items: [] });
    }

    const baseWhere = {
      contadorId:  vinculo.contadorId,
      publicadoAt: { gte: vinculo.assignedAt },
      deletedAt:   null,
    };

    const [total, items] = await Promise.all([
      prisma.comunicado.count({ where: baseWhere }),
      prisma.comunicado.findMany({
        where:   baseWhere,
        orderBy: { publicadoAt: 'desc' },
        skip,
        take:    perPage,
        include: {
          destinatarios: {
            where:  { clienteId: auth.sub },
            select: { lido: true, confirmado: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      perPage,
      items: items.map((c) => {
        const dest = c.destinatarios[0] ?? null;
        return {
          id:               c.id,
          titulo:           c.titulo,
          conteudo:         c.conteudo.replace(/<[^>]+>/g, '').slice(0, 120),
          exigeConfirmacao: c.exigeConfirmacao,
          publicadoAt:      c.publicadoAt.toISOString(),
          souDestinatario:  dest !== null,
          lido:             dest?.lido ?? false,
          confirmado:       dest?.confirmado ?? false,
        };
      }),
    });
  } catch (err) {
    logger.error('[GET /comunicados] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'CLIENT']);
