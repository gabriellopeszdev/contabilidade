import { NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';
import { chatCompletion, type IaConfig, type IaProvider } from '../../../../../../src/utils/aiClient';
import { getPlanInfo, hasFeature, FEATURES } from '../../../../../../src/utils/planLimits';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/clientes/[id]/regime-ia
//
// Analisa o perfil do cliente e recomenda o melhor regime tributário via IA.
//
// Sem body necessário.
//
// Respostas:
//   200 OK  → { regime: { regimeRecomendado, justificativa, vantagens, desvantagens, alertas } }
//   403     → plano não inclui IA ou cliente não pertence ao contador
//   503     → IA não configurada
// =============================================================================

export const POST = withAuth(async (req, ctx, auth) => {
  const { id: clienteId } = (ctx as ResolvedRouteContext).params;

  // Plan gating — verificar antes de qualquer outra coisa
  const plan = await getPlanInfo(auth.sub);
  if (!hasFeature(plan, FEATURES.IA)) {
    return NextResponse.json(
      { message: 'A Sugestão de Regime Tributário está disponível apenas no plano Enterprise. Faça upgrade para acessar.' },
      { status: 403 },
    );
  }

  // Verificação IDOR: cliente pertence ao contador?
  const contadorId = auth.sub;
  const vinculo = await prisma.contadorCliente.findUnique({
    where: { contadorId_clienteId: { contadorId, clienteId } },
  });
  if (!vinculo) {
    return NextResponse.json(
      { message: 'Cliente não encontrado ou não pertence à sua carteira.' },
      { status: 403 },
    );
  }

  try {
    // Configuração de IA (waterfall: escritório → sistema → env)
    const [configEscritorio, configSistema] = await Promise.all([
      prisma.configuracaoEscritorio.findUnique({
        where:  { contadorId },
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

    const iaConfig: IaConfig = { provider, apiKey };

    // Busca dados do cliente
    const cliente = await prisma.usuarioCliente.findFirst({
      where:  { id: clienteId, deletedAt: null },
      select: { id: true, name: true, cnpj: true, cnae: true, regimeTributario: true },
    });

    if (!cliente) {
      return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
    }

    const systemPrompt = `You are a Brazilian tax expert specialized in selecting optimal tax regimes. Based on the client profile provided, recommend the best tax regime (MEI, Simples Nacional, Lucro Presumido, or Lucro Real). Return ONLY a valid JSON object — no markdown, no explanation outside the JSON.

Output structure:
{
  "regimeRecomendado": "string (one of: MEI, Simples Nacional, Lucro Presumido, Lucro Real)",
  "justificativa": "string (2-3 paragraphs in pt-BR explaining the recommendation)",
  "vantagens": ["string", ...],
  "desvantagens": ["string", ...],
  "alertas": ["string", ...]
}`;

    const userMessage = `Perfil do cliente:
- Nome: ${cliente.name}
- CNPJ: ${cliente.cnpj}
- Regime Tributário Atual: ${cliente.regimeTributario ?? 'Não informado'}
- CNAE (atividade econômica): ${cliente.cnae ?? 'Não informado'}`;

    const rawText = await chatCompletion(iaConfig, systemPrompt, userMessage);

    // Parse do JSON retornado pela IA
    interface RegimeIaResult {
      regimeRecomendado: string;
      justificativa:     string;
      vantagens:         string[];
      desvantagens:      string[];
      alertas:           string[];
    }

    let regime: RegimeIaResult;
    try {
      regime = JSON.parse(rawText) as RegimeIaResult;
    } catch {
      // Tenta extrair JSON com regex
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          regime = JSON.parse(match[0]) as RegimeIaResult;
        } catch {
          logger.error('[POST /regime-ia] Falha ao parsear JSON da IA', undefined);
          return NextResponse.json(
            { message: 'A IA retornou uma resposta inválida. Tente novamente.' },
            { status: 500 },
          );
        }
      } else {
        logger.error('[POST /regime-ia] Nenhum JSON encontrado na resposta da IA', undefined);
        return NextResponse.json(
          { message: 'A IA retornou uma resposta inválida. Tente novamente.' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ regime });
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
      logger.warn('[POST /regime-ia] Quota/rate-limit da IA', { status });
      return NextResponse.json(
        { message: 'Limite de uso da IA atingido. Aguarde alguns minutos e tente novamente, ou troque o provedor em Configurações.' },
        { status: 429 },
      );
    }

    if (isModelNotFound) {
      logger.warn('[POST /regime-ia] Modelo da IA indisponível', { status, message: message.slice(0, 200) });
      return NextResponse.json(
        { message: 'Modelo de IA indisponível. O administrador precisa atualizar a configuração em Configurações → IA.' },
        { status: 503 },
      );
    }

    logger.error('[POST /regime-ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
