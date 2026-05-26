import { NextResponse } from 'next/server';
import { withAuth } from '@/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/infrastructure/di/Container';

export const PASSOS_ONBOARDING = [
  { id: 'configurar-escritorio', titulo: 'Configure seu escritório', descricao: 'Adicione nome, logo e cores em Configurações', href: '/configuracoes' },
  { id: 'adicionar-cliente',     titulo: 'Adicione seu primeiro cliente', descricao: 'Cadastre um cliente na sua carteira', href: '/clientes' },
  { id: 'enviar-documento',      titulo: 'Envie um documento', descricao: 'Faça upload de um documento fiscal', href: '/lote' },
  { id: 'criar-obrigacao',       titulo: 'Configure o calendário fiscal', descricao: 'Adicione obrigações recorrentes', href: '/calendario' },
  { id: 'explorar-kanban',       titulo: 'Explore o Kanban', descricao: 'Gerencie tarefas no quadro Kanban', href: '/dashboard' },
] as const;

export const GET = withAuth(async (req, ctx, auth) => {
  const contador = await prisma.usuarioContador.findUnique({
    where: { id: auth.sub },
    select: { onboardingPassos: true, onboardingConcluido: true },
  });

  if (!contador) return NextResponse.json({ message: 'Não encontrado' }, { status: 404 });

  const passosCompletos = contador.onboardingPassos;
  const passos = PASSOS_ONBOARDING.map((p) => ({ ...p, concluido: passosCompletos.includes(p.id) }));

  return NextResponse.json({
    passos,
    totalConcluidos: passosCompletos.length,
    total: PASSOS_ONBOARDING.length,
    concluido: contador.onboardingConcluido,
  });
}, ['ACCOUNTANT']);

export const PATCH = withAuth(async (req, ctx, auth) => {
  const body = await req.json() as { passoId?: string; concluirTudo?: boolean };
  const { passoId, concluirTudo } = body;

  const contador = await prisma.usuarioContador.findUnique({
    where: { id: auth.sub },
    select: { onboardingPassos: true },
  });
  if (!contador) return NextResponse.json({ message: 'Não encontrado' }, { status: 404 });

  if (concluirTudo) {
    await prisma.usuarioContador.update({
      where: { id: auth.sub },
      data: { onboardingConcluido: true },
    });
    return NextResponse.json({ message: 'Onboarding concluído' });
  }

  if (!passoId) return NextResponse.json({ message: 'passoId é obrigatório' }, { status: 400 });

  const passoValido = PASSOS_ONBOARDING.find((p) => p.id === passoId);
  if (!passoValido) return NextResponse.json({ message: 'Passo inválido' }, { status: 400 });

  const novosPassos = [...new Set([...contador.onboardingPassos, passoId])];
  const todosCompletos = PASSOS_ONBOARDING.every((p) => novosPassos.includes(p.id));

  await prisma.usuarioContador.update({
    where: { id: auth.sub },
    data: { onboardingPassos: novosPassos, onboardingConcluido: todosCompletos },
  });

  return NextResponse.json({ passosCompletos: novosPassos, concluido: todosCompletos });
}, ['ACCOUNTANT']);
