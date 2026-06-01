import { NextRequest, NextResponse } from 'next/server';

import { withAuth }                                        from '../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext }                               from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                                          from '../../../../../src/infrastructure/di/Container';
import { logger }                                          from '../../../../../src/utils/logger';
import { chatCompletion, type IaConfig, type IaProvider }  from '../../../../../src/utils/aiClient';
import { getPlanInfo, hasFeature, FEATURES }               from '../../../../../src/utils/planLimits';

// =============================================================================
// Configuração do runtime Next.js
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Tipos
// =============================================================================

interface NFeItem {
  numero?:       string;
  dataEmissao:   string;
  emitente:      { nome: string; cnpj: string; uf: string };
  destinatario:  { nome: string; cnpjOuCpf: string };
  valorTotal:    number;
  impostos:      { icms: number; ipi?: number; pis?: number; cofins?: number };
  tipo:          'entrada' | 'saida';
}

interface AnaliseIa {
  resumo:              string;
  totalEntradas:       number;
  totalSaidas:         number;
  valorTotalEntradas:  number;
  valorTotalSaidas:    number;
  alertas:             { tipo: 'warning' | 'info' | 'error'; mensagem: string }[];
  observacoes:         string[];
}

// =============================================================================
// POST /api/v1/nfe/analisar
//
// Recebe um array de NFeItem já parseados pelo frontend e os envia à IA
// para análise fiscal. Retorna um objeto com resumo, totais, alertas e
// observações em português brasileiro.
//
// Headers obrigatórios:
//   Authorization: Bearer <jwt>
//   Content-Type:  application/json
//
// Body:
//   { nfes: NFeItem[] }
//
// Respostas:
//   200 OK   → { analise: AnaliseIa }
//   400      → { message: string }
//   403      → { message: string }  (sem permissão ou plano insuficiente)
//   429      → { message: string }  (quota IA)
//   503      → { message: string }  (IA não configurada)
//   500      → { message: string }
// =============================================================================

export const POST = withAuth(async (req: NextRequest, _ctx: RouteContext, auth) => {

  // ---------------------------------------------------------------------------
  // 1. Verificação de plano (plan gating) — antes de qualquer outra operação
  // ---------------------------------------------------------------------------
  const plan = await getPlanInfo(auth.sub);
  if (!hasFeature(plan, FEATURES.IA)) {
    return NextResponse.json(
      { message: 'A Análise IA de NF-e está disponível apenas no plano Enterprise. Faça upgrade para acessar.' },
      { status: 403 },
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Parse do body
  // ---------------------------------------------------------------------------
  let nfes: NFeItem[];
  try {
    const body = await req.json() as { nfes?: NFeItem[] };
    if (!body.nfes || !Array.isArray(body.nfes) || body.nfes.length === 0) {
      return NextResponse.json(
        { message: 'Envie ao menos uma NF-e no campo "nfes".' },
        { status: 400 },
      );
    }
    nfes = body.nfes;
  } catch {
    return NextResponse.json(
      { message: 'Corpo da requisição inválido. Esperado JSON com campo "nfes".' },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Configuração da IA (waterfall: escritório → sistema → env var)
  // ---------------------------------------------------------------------------
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
        { message: 'IA não configurada. O administrador precisa definir a chave de API em Configurações.' },
        { status: 503 },
      );
    }

    const iaConfig: IaConfig = { provider, apiKey };

    // -------------------------------------------------------------------------
    // 4. Montagem do prompt e chamada à IA
    // -------------------------------------------------------------------------
    const systemPrompt = `You are a Brazilian fiscal/tax expert analyzing NF-e (Nota Fiscal Eletrônica) data. Analyze the provided NF-e batch and return a JSON object with this structure only — no markdown:
{
  "resumo": "2-3 sentence overview in pt-BR",
  "totalEntradas": number,
  "totalSaidas": number,
  "valorTotalEntradas": number,
  "valorTotalSaidas": number,
  "alertas": [{ "tipo": "warning"|"info"|"error", "mensagem": "string" }],
  "observacoes": ["string", ...]
}`;

    const userMessage = JSON.stringify(nfes);

    const rawText = await chatCompletion(iaConfig, systemPrompt, userMessage);

    // -------------------------------------------------------------------------
    // 5. Parse da resposta JSON da IA
    // -------------------------------------------------------------------------
    let analise: AnaliseIa;
    try {
      analise = JSON.parse(rawText) as AnaliseIa;
    } catch {
      // Tenta extrair o objeto JSON com regex
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          analise = JSON.parse(match[0]) as AnaliseIa;
        } catch {
          logger.error('[POST /nfe/analisar] Falha ao parsear JSON da IA (regex)', undefined);
          return NextResponse.json(
            { message: 'A IA retornou uma resposta inválida. Tente novamente.' },
            { status: 500 },
          );
        }
      } else {
        logger.error('[POST /nfe/analisar] Nenhum JSON encontrado na resposta da IA', undefined);
        return NextResponse.json(
          { message: 'A IA retornou uma resposta inválida. Tente novamente.' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ analise });

  } catch (err) {
    // -------------------------------------------------------------------------
    // 6. Tratamento de erros conhecidos (quota, modelo indisponível)
    // -------------------------------------------------------------------------
    const status  = (err as { status?: number }).status;
    const message = err instanceof Error ? err.message : '';

    const isQuota =
      status === 429 || status === 529 ||
      /quota|rate.?limit|resource_exhausted|too many requests/i.test(message);

    const isModelNotFound =
      status === 404 ||
      /no longer available|model.*not found|not_found/i.test(message);

    if (isQuota) {
      logger.warn('[POST /nfe/analisar] Quota/rate-limit da IA', { status });
      return NextResponse.json(
        { message: 'Limite de uso da IA atingido. Aguarde alguns minutos e tente novamente, ou troque o provedor em Configurações.' },
        { status: 429 },
      );
    }

    if (isModelNotFound) {
      logger.warn('[POST /nfe/analisar] Modelo da IA indisponível', { status, message: message.slice(0, 200) });
      return NextResponse.json(
        { message: 'Modelo de IA indisponível. O administrador precisa atualizar a configuração em Configurações → IA.' },
        { status: 503 },
      );
    }

    logger.error('[POST /nfe/analisar] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }

}, ['ACCOUNTANT', 'ADMIN']);
