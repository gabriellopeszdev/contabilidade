import { NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                               from '../../../../src/infrastructure/di/Container';
import { logger }                               from '../../../../src/utils/logger';
import { chatWithHistory, type IaConfig, type IaProvider } from '../../../../src/utils/aiClient';
import { getPlanInfo, hasFeature, FEATURES }    from '../../../../src/utils/planLimits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT =
  'You are an expert Brazilian accounting assistant helping accountants (contadores) with fiscal, tax, accounting questions. Answer in Brazilian Portuguese. Be precise, cite legal grounds when relevant.';

// Quantas mensagens recentes mandar para a IA como contexto
const MAX_CONTEXTO = 20;

// =============================================================================
// GET /api/v1/chat-ia
//
// Retorna o histórico persistido do contador (últimas 100 mensagens).
// =============================================================================

export const GET = withAuth(async (_req, _ctx: ResolvedRouteContext, auth) => {
  const plan = await getPlanInfo(auth.sub);
  if (!hasFeature(plan, FEATURES.IA)) {
    return NextResponse.json(
      { message: 'O Assistente IA está disponível apenas no plano Enterprise. Faça upgrade para acessar.' },
      { status: 403 },
    );
  }

  try {
    const mensagens = await prisma.chatIaMensagem.findMany({
      where:   { contadorId: auth.sub },
      orderBy: { createdAt: 'asc' },
      take:    100,
      select:  { id: true, role: true, content: true, createdAt: true },
    });

    return NextResponse.json({ mensagens });
  } catch (err) {
    logger.error('[GET /chat-ia] Erro ao buscar histórico', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// POST /api/v1/chat-ia
//
// Envia uma mensagem, obtém resposta da IA e persiste ambas no banco.
//
// Body (JSON):
//   { message: string }
//
// Respostas:
//   200 OK  → { reply: string, mensagemId: string }
//   403     → plano não inclui IA
//   503     → API key não configurada, ou modelo indisponível
//   429     → quota/rate-limit atingido
// =============================================================================

export const POST = withAuth(async (req, _ctx: ResolvedRouteContext, auth) => {
  const plan = await getPlanInfo(auth.sub);
  if (!hasFeature(plan, FEATURES.IA)) {
    return NextResponse.json(
      { message: 'O Assistente IA está disponível apenas no plano Enterprise. Faça upgrade para acessar.' },
      { status: 403 },
    );
  }

  let userContent = '';
  try {
    const body = await req.json() as { message?: string };
    userContent = (body.message ?? '').trim();
  } catch {
    return NextResponse.json({ message: 'Body inválido.' }, { status: 400 });
  }

  if (!userContent) {
    return NextResponse.json({ message: 'Envie uma mensagem.' }, { status: 400 });
  }

  try {
    const [configEscritorio, configSistema] = await Promise.all([
      prisma.configuracaoEscritorio.findUnique({
        where:  { contadorId: auth.sub },
        select: { iaProvider: true, iaApiKey: true },
      }),
      prisma.configuracaoSistema.findUnique({
        where:  { id: 'system' },
        select: { iaProvider: true, iaApiKey: true },
      }),
    ]);

    const provider = (
      (configEscritorio?.iaApiKey ? configEscritorio.iaProvider : null) ??
      configSistema?.iaProvider ??
      'anthropic'
    ) as IaProvider;
    const apiKey =
      configEscritorio?.iaApiKey ??
      configSistema?.iaApiKey ??
      process.env.ANTHROPIC_API_KEY ??
      '';

    if (!apiKey) {
      return NextResponse.json(
        { message: 'IA do sistema não configurada. O administrador precisa definir a chave de API em Configurações.' },
        { status: 503 },
      );
    }

    // Busca últimas mensagens do banco para passar como contexto à IA
    const historicoDB = await prisma.chatIaMensagem.findMany({
      where:   { contadorId: auth.sub },
      orderBy: { createdAt: 'asc' },
      take:    MAX_CONTEXTO,
      select:  { role: true, content: true },
    });

    const contexto = [
      ...historicoDB.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userContent },
    ];

    const iaConfig: IaConfig = { provider, apiKey };
    const reply = await chatWithHistory(iaConfig, SYSTEM_PROMPT, contexto);

    // Persiste user message + assistant reply
    await prisma.chatIaMensagem.createMany({
      data: [
        { contadorId: auth.sub, role: 'user',      content: userContent },
        { contadorId: auth.sub, role: 'assistant', content: reply },
      ],
    });

    return NextResponse.json({ reply });
  } catch (err) {
    const status  = (err as { status?: number }).status;
    const message = err instanceof Error ? err.message : '';

    const isQuota =
      status === 429 || status === 529 ||
      /quota|rate.?limit|resource_exhausted|too many requests/i.test(message);

    const isModelNotFound =
      status === 404 ||
      /no longer available|model.*not found|not_found/i.test(message);

    if (isQuota) {
      logger.warn('[POST /chat-ia] Quota/rate-limit da IA', { status });
      return NextResponse.json(
        { message: 'Limite de uso da IA atingido. Aguarde alguns minutos e tente novamente, ou troque o provedor em Configurações.' },
        { status: 429 },
      );
    }

    if (isModelNotFound) {
      logger.warn('[POST /chat-ia] Modelo da IA indisponível', { status, message: message.slice(0, 200) });
      return NextResponse.json(
        { message: 'Modelo de IA indisponível. O administrador precisa atualizar a configuração em Configurações → IA.' },
        { status: 503 },
      );
    }

    logger.error('[POST /chat-ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// DELETE /api/v1/chat-ia
//
// Apaga todo o histórico do contador (Nova Conversa).
// =============================================================================

export const DELETE = withAuth(async (_req, _ctx: ResolvedRouteContext, auth) => {
  try {
    await prisma.chatIaMensagem.deleteMany({ where: { contadorId: auth.sub } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /chat-ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
