import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { StatusAssinaturaSaaS } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/admin/subscricoes — Lista todas as assinaturas SaaS + métricas
// =============================================================================

export const GET = withAuth(async (req: NextRequest) => {
  const url    = new URL(req.url);
  const status = url.searchParams.get('status') as StatusAssinaturaSaaS | null;
  const search = url.searchParams.get('search')?.trim() || undefined;

  const subscricoes = await prisma.assinaturaSaaS.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            escritorio: {
              OR: [
                { name:  { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    },
    include: {
      plano: { select: { id: true, nome: true, preco: true } },
      escritorio: {
        select: {
          id:       true,
          name:     true,
          email:    true,
          isActive: true,
          configuracao: { select: { nomeEscritorio: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Escritórios SEM assinatura
  const comSubscricao = subscricoes.map((s) => s.escritorioId);
  const semSubscricao = await prisma.usuarioContador.findMany({
    where: { id: { notIn: comSubscricao }, isAdmin: false, deletedAt: null },
    select: {
      id:       true,
      name:     true,
      email:    true,
      isActive: true,
      configuracao: { select: { nomeEscritorio: true } },
    },
  });

  // MRR: soma dos valorMensal das assinaturas ATIVAS
  const mrr = subscricoes
    .filter((s) => s.status === 'ATIVO')
    .reduce((acc, s) => acc + Number(s.valorMensal), 0);

  return NextResponse.json({
    subscricoes: subscricoes.map((s) => ({
      id:               s.id,
      status:           s.status,
      escritorioId:     s.escritorioId,
      escritorioNome:   s.escritorio.configuracao?.nomeEscritorio ?? s.escritorio.name,
      escritorioEmail:  s.escritorio.email,
      escritorioAtivo:  s.escritorio.isActive,
      planoId:          s.plano.id,
      planoNome:        s.plano.nome,
      precoPlano:       Number(s.plano.preco),
      valorMensal:      Number(s.valorMensal),
      diaVencimento:    s.diaVencimento,
      dataInicio:       s.dataInicio,
      dataRenovacao:    s.dataRenovacao,
      observacoes:      s.observacoes,
    })),
    semSubscricao: semSubscricao.map((e) => ({
      id:       e.id,
      nome:     e.configuracao?.nomeEscritorio ?? e.name,
      email:    e.email,
      isActive: e.isActive,
    })),
    mrr,
    totalAtivo:        subscricoes.filter((s) => s.status === 'ATIVO').length,
    totalTrial:        subscricoes.filter((s) => s.status === 'TRIAL').length,
    totalInadimplente: subscricoes.filter((s) => s.status === 'INADIMPLENTE').length,
  });
}, ['ADMIN']);

// =============================================================================
// POST /api/v1/admin/subscricoes — Atribui ou atualiza uma assinatura (upsert)
// =============================================================================

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json() as {
    escritorioId:  string;
    planoId:       string;
    status?:       string;
    valorMensal?:  number;
    diaVencimento?: number;
    dataRenovacao?: string;
    observacoes?:  string;
  };

  if (!body.escritorioId || !body.planoId) {
    return NextResponse.json(
      { message: 'escritorioId e planoId são obrigatórios.' },
      { status: 400 },
    );
  }

  const plano = await prisma.planoSaaS.findUnique({ where: { id: body.planoId } });
  if (!plano) {
    return NextResponse.json({ message: 'Plano não encontrado.' }, { status: 404 });
  }

  const proximaRenovacao = body.dataRenovacao
    ? new Date(body.dataRenovacao)
    : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; })();

  const sub = await prisma.assinaturaSaaS.upsert({
    where:  { escritorioId: body.escritorioId },
    update: {
      planoId:       body.planoId,
      status:        (body.status as StatusAssinaturaSaaS) ?? 'TRIAL',
      valorMensal:   body.valorMensal  ?? plano.preco,
      diaVencimento: body.diaVencimento ?? 10,
      dataRenovacao: proximaRenovacao,
      observacoes:   body.observacoes ?? null,
    },
    create: {
      escritorioId:  body.escritorioId,
      planoId:       body.planoId,
      status:        (body.status as StatusAssinaturaSaaS) ?? 'TRIAL',
      valorMensal:   body.valorMensal ?? plano.preco,
      diaVencimento: body.diaVencimento ?? 10,
      dataRenovacao: proximaRenovacao,
      observacoes:   body.observacoes ?? null,
    },
  });

  return NextResponse.json({ id: sub.id }, { status: 201 });
}, ['ADMIN']);
