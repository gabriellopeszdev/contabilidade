import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

// Passos base (sem feature) + passos condicionais (com feature).
// A integração com Asaas e outros serviços externos é configurada pelo admin —
// não inclua tarefas que o contador não pode executar por conta própria.
export const PASSOS_ONBOARDING = [
  {
    id:       'configurar-escritorio',
    titulo:   'Configure seu escritório',
    descricao:'Adicione nome, logo e cores em Configurações',
    href:     '/configuracoes',
    feature:  null,
  },
  {
    id:       'adicionar-cliente',
    titulo:   'Adicione seu primeiro cliente',
    descricao:'Cadastre um cliente na sua carteira',
    href:     '/clientes',
    feature:  null,
  },
  {
    id:       'enviar-documento',
    titulo:   'Envie um documento',
    descricao:'Faça upload de um documento fiscal para um cliente',
    href:     '/lote',
    feature:  null,
  },
  {
    id:       'criar-obrigacao',
    titulo:   'Configure o calendário fiscal',
    descricao:'Adicione obrigações recorrentes para seus clientes',
    href:     '/calendario',
    feature:  null,
  },
  {
    id:       'explorar-kanban',
    titulo:   'Explore o Kanban',
    descricao:'Gerencie tarefas e documentos no quadro de trabalho',
    href:     '/dashboard',
    feature:  null,
  },
  {
    id:       'convidar-equipe',
    titulo:   'Monte sua equipe',
    descricao:'Convide colaboradores e defina setores de acesso',
    href:     '/equipe',
    feature:  'equipe',
  },
  {
    id:       'explorar-relatorios',
    titulo:   'Explore os relatórios',
    descricao:'Acompanhe a produtividade do escritório com dados em tempo real',
    href:     '/relatorios',
    feature:  'relatorios',
  },
  {
    id:       'explorar-assinatura',
    titulo:   'Assine documentos digitalmente',
    descricao:'Envie contratos e procurações para assinatura eletrônica',
    href:     '/assinaturas',
    feature:  'assinatura_eletronica',
  },
  {
    id:       'explorar-ia',
    titulo:   'Experimente a IA do FiscoHub',
    descricao:'Gere obrigações fiscais e analise clientes com inteligência artificial',
    href:     '/chat-ia',
    feature:  'ia',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  feature: string | null;
}>;

// =============================================================================
// GET /api/v1/onboarding
//
// Retorna os passos filtrados pelo plano do contador.
// =============================================================================

export const GET = withAuth(async (req, ctx, auth) => {
  const contador = await prisma.usuarioContador.findUnique({
    where:  { id: auth.sub },
    select: { onboardingPassos: true, onboardingConcluido: true },
  });

  if (!contador) return NextResponse.json({ message: 'Não encontrado' }, { status: 404 });

  // Busca features do plano atual (fallback: trial tem apenas chat e calendario)
  const assinatura = await prisma.assinaturaSaaS.findUnique({
    where:   { escritorioId: auth.sub },
    include: { plano: { select: { features: true } } },
  });
  const features: string[] = assinatura?.plano.features ?? ['chat', 'calendario'];

  // Filtra passos disponíveis para o plano
  const passosDisponiveis = PASSOS_ONBOARDING.filter(
    (p) => p.feature === null || features.includes(p.feature),
  );

  const passosCompletos = contador.onboardingPassos;
  const passos = passosDisponiveis.map((p) => ({ ...p, concluido: passosCompletos.includes(p.id) }));

  const totalConcluidos = passos.filter((p) => p.concluido).length;
  const todosCompletos   = totalConcluidos === passos.length && passos.length > 0;

  return NextResponse.json({
    passos,
    totalConcluidos,
    total:     passos.length,
    concluido: contador.onboardingConcluido || todosCompletos,
  });
}, ['ACCOUNTANT']);

// =============================================================================
// PATCH /api/v1/onboarding
//
// Marca um passo como concluído ou dispensa o onboarding.
// =============================================================================

export const PATCH = withAuth(async (req, ctx, auth) => {
  const body = await req.json() as { passoId?: string; concluirTudo?: boolean };
  const { passoId, concluirTudo } = body;

  const contador = await prisma.usuarioContador.findUnique({
    where:  { id: auth.sub },
    select: { onboardingPassos: true },
  });
  if (!contador) return NextResponse.json({ message: 'Não encontrado' }, { status: 404 });

  if (concluirTudo) {
    await prisma.usuarioContador.update({
      where: { id: auth.sub },
      data:  { onboardingConcluido: true },
    });
    return NextResponse.json({ message: 'Onboarding concluído' });
  }

  if (!passoId) return NextResponse.json({ message: 'passoId é obrigatório' }, { status: 400 });

  const passoValido = PASSOS_ONBOARDING.find((p) => p.id === passoId);
  if (!passoValido) return NextResponse.json({ message: 'Passo inválido' }, { status: 400 });

  const novosPassos  = [...new Set([...contador.onboardingPassos, passoId])];
  const todosCompletos = PASSOS_ONBOARDING.filter((p) => p.feature === null).every((p) =>
    novosPassos.includes(p.id),
  );

  await prisma.usuarioContador.update({
    where: { id: auth.sub },
    data:  { onboardingPassos: novosPassos, onboardingConcluido: todosCompletos },
  });

  return NextResponse.json({ passosCompletos: novosPassos, concluido: todosCompletos });
}, ['ACCOUNTANT']);
