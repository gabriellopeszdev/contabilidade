import { NextResponse } from 'next/server';

import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';
import { chatCompletion, type IaConfig, type IaProvider } from '../../../../../../src/utils/aiClient';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Tipos
// =============================================================================

interface ObrigacaoSugerida {
  nome:              string;
  descricao?:        string;
  diaVencimento:     number;
  cor?:              string;
  recorrencia?:      string;
  mesesAplicacao:    number[];
  fundamentoLegal?:  string;
}

// =============================================================================
// POST /api/v1/clientes/[id]/obrigacoes-ia
//
// Gera sugestões de obrigações fiscais via IA (Claude) com base no perfil do
// cliente. Opcionalmente cria os registros se `criar: true` for enviado no body.
//
// Body (JSON):
//   { criar?: boolean, obrigacoesSelecionadas?: ObrigacaoSugerida[] }
//
// Respostas:
//   200 OK  → { obrigacoes: ObrigacaoSugerida[], criadas: boolean }
//   403     → cliente não pertence ao contador
//   404     → cliente não encontrado
//   503     → ANTHROPIC_API_KEY não configurada
// =============================================================================

export const POST = withAuth(async (req, ctx, auth) => {
  const { id: clienteId } = (ctx as ResolvedRouteContext).params;

  // Só contadores donos podem usar a IA
  if (auth.role !== 'ACCOUNTANT' && auth.role !== 'ADMIN') {
    return NextResponse.json(
      { message: 'Sem permissão para usar esta funcionalidade.' },
      { status: 403 },
    );
  }

  // Lê body (opcional)
  let criar = false;
  let obrigacoesSelecionadas: ObrigacaoSugerida[] | undefined;
  try {
    const body = await req.json() as { criar?: boolean; obrigacoesSelecionadas?: ObrigacaoSugerida[] };
    criar = body.criar === true;
    obrigacoesSelecionadas = body.obrigacoesSelecionadas;
  } catch {
    // body vazio — tudo bem
  }

  try {
    // Verificação IDOR: cliente pertence ao contador?
    const contadorId = auth.sub;

    const [vinculo, configEscritorio, configSistema] = await Promise.all([
      prisma.contadorCliente.findUnique({
        where: { contadorId_clienteId: { contadorId, clienteId } },
      }),
      prisma.configuracaoEscritorio.findUnique({
        where:  { contadorId },
        select: { iaProvider: true, iaApiKey: true },
      }),
      prisma.configuracaoSistema.findUnique({
        where:  { id: 'system' },
        select: { iaProvider: true, iaApiKey: true },
      }),
    ]);

    if (!vinculo) {
      return NextResponse.json(
        { message: 'Cliente não encontrado ou não pertence à sua carteira.' },
        { status: 403 },
      );
    }

    // Ordem de prioridade: config do contador → config do sistema → env var
    const provider = (
      (configEscritorio?.iaApiKey ? configEscritorio.iaProvider : null) ??
      configSistema?.iaProvider ??
      'anthropic'
    ) as IaProvider;
    const apiKey   =
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
      where: { id: clienteId, deletedAt: null },
      select: {
        id:               true,
        name:             true,
        cnpj:             true,
        cnae:             true,
        regimeTributario: true,
      },
    });

    if (!cliente) {
      return NextResponse.json(
        { message: 'Cliente não encontrado.' },
        { status: 404 },
      );
    }

    // Se modo criar com lista já selecionada — pula a chamada à IA
    if (criar && obrigacoesSelecionadas && obrigacoesSelecionadas.length > 0) {
      await criarObrigacoes(contadorId, obrigacoesSelecionadas);
      return NextResponse.json({ obrigacoes: obrigacoesSelecionadas, criadas: true });
    }

    // System prompt: regras e formato de saída
    const systemPrompt = `You are a Brazilian tax expert. Generate fiscal obligations as a JSON array only — no markdown, no explanation.

Output structure per item:
{
  "nome": string,
  "descricao": string,
  "diaVencimento": number (1-31),
  "cor": hex string,
  "recorrencia": "MENSAL" | "BIMESTRAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL",
  "mesesAplicacao": number[] (1-12),
  "fundamentoLegal": string
}

Rules:
- cor: blue #3b82f6 = federal, green #10b981 = state, orange #f59e0b = municipal
- For MEI: DAS-MEI (day 20, monthly), DASN-SIMEI (annual, May)
- For Simples Nacional: DAS (day 20, monthly), DEFIS (annual, March), PGDAS-D (monthly)
- For Lucro Presumido: IRPJ/CSLL (quarterly), PIS/COFINS (monthly), DCTF (monthly)
- For Lucro Real: IRPJ/CSLL (monthly ESTIMATIVA or quarterly), PIS/COFINS (monthly), ECF (annual)
- Always include: FGTS (day 7), eSocial if applicable
- Generate 5-12 obligations appropriate for the regime`;

    const userMessage = `Client profile:
- Company name: ${cliente.name}
- CNPJ: ${cliente.cnpj}
- Tax regime: ${cliente.regimeTributario ?? 'Não informado'}
- CNAE (economic activity): ${cliente.cnae ?? 'Não informado'}`;

    // Chama a IA via abstração multi-provider
    const rawText = await chatCompletion(iaConfig, systemPrompt, userMessage);

    // Parse do JSON retornado pela IA
    let obrigacoes: ObrigacaoSugerida[] = [];
    try {
      obrigacoes = JSON.parse(rawText) as ObrigacaoSugerida[];
    } catch {
      // Tenta extrair JSON com regex
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          obrigacoes = JSON.parse(match[0]) as ObrigacaoSugerida[];
        } catch {
          logger.error('[POST /obrigacoes-ia] Falha ao parsear JSON da IA', undefined);
          return NextResponse.json(
            { message: 'A IA retornou uma resposta inválida. Tente novamente.' },
            { status: 500 },
          );
        }
      } else {
        logger.error('[POST /obrigacoes-ia] Nenhum JSON encontrado na resposta da IA', undefined);
        return NextResponse.json(
          { message: 'A IA retornou uma resposta inválida. Tente novamente.' },
          { status: 500 },
        );
      }
    }

    // Valida e normaliza campos
    obrigacoes = obrigacoes.map((o) => ({
      nome:             String(o.nome ?? ''),
      descricao:        o.descricao ? String(o.descricao) : undefined,
      diaVencimento:    Number(o.diaVencimento) || 1,
      cor:              o.cor ? String(o.cor) : undefined,
      recorrencia:      o.recorrencia ? String(o.recorrencia) : undefined,
      mesesAplicacao:   Array.isArray(o.mesesAplicacao) ? o.mesesAplicacao.map(Number) : [],
      fundamentoLegal:  o.fundamentoLegal ? String(o.fundamentoLegal) : undefined,
    }));

    // Se criar: true foi enviado sem lista selecionada — cria todas
    if (criar) {
      await criarObrigacoes(contadorId, obrigacoes);
      return NextResponse.json({ obrigacoes, criadas: true });
    }

    return NextResponse.json({ obrigacoes, criadas: false });
  } catch (err) {
    logger.error('[POST /obrigacoes-ia] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// Helper: cria ObrigacaoFiscal records
// =============================================================================

async function criarObrigacoes(contadorId: string, obrigacoes: ObrigacaoSugerida[]): Promise<void> {
  const RECORRENCIAS_VALIDAS = new Set(['MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']);

  await prisma.obrigacaoFiscal.createMany({
    data: obrigacoes.map((o) => ({
      contadorId,
      nome:             o.nome,
      descricao:        o.descricao ?? null,
      diaVencimento:    Math.min(Math.max(Math.round(o.diaVencimento), 1), 31),
      cor:              o.cor ?? '#3b82f6',
      recorrencia:      (o.recorrencia && RECORRENCIAS_VALIDAS.has(o.recorrencia)
                          ? o.recorrencia
                          : 'MENSAL') as 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL',
      mesesAplicacao:   o.mesesAplicacao,
    })),
    skipDuplicates: true,
  });
}
