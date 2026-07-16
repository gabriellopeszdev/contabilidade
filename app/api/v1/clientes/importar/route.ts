import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, queueProducer } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';
import { checkClienteLimit } from '../../../../../src/utils/planLimits';
import { checkRateLimit } from '../../../../../src/utils/rateLimiter';
import { criarClienteSchema } from '../../../../../src/infrastructure/http/validators/CriarClienteSchema';
import { parseCSV } from '../../../../../src/utils/csv';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Constantes
// =============================================================================

const INVITE_EXPIRY_HOURS = 48;
const BATCH_SIZE          = 25;

// =============================================================================
// Mapeamento de cabeçalhos CSV → campos internos (case-insensitive)
// =============================================================================

const COLUMN_MAP: Record<string, string> = {
  nome:               'nome',
  email:              'email',
  cnpj:               'cnpj',
  telefone:           'phone',
  phone:              'phone',
  cnae:               'cnae',
  'regime tributário': 'regimeTributario',
  'regime tributario': 'regimeTributario',
  regimetributario:   'regimeTributario',
};

function mapearColuna(header: string): string | null {
  return COLUMN_MAP[header.trim().toLowerCase()] ?? null;
}

// =============================================================================
// POST /api/v1/clientes/importar
//
// Recebe multipart/form-data com campo `file` (CSV) e importa clientes em massa.
//
// Body: FormData { file: File (.csv, UTF-8) }
//
// Respostas:
//   200 OK  → { totalLinhas, sucesso, falhas, erros: [{ linha, motivo }] }
//   400     → arquivo ausente, CSV inválido, sem colunas obrigatórias
//   403     → limite de plano seria ultrapassado
//   429     → rate limit de importação excedido
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  // ---------------------------------------------------------------------------
  // 1. Rate limit: 5 imports por hora por contador
  // ---------------------------------------------------------------------------
  const rl = await checkRateLimit(`import:clientes:${auth.sub}`, 5, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Limite de importações excedido. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Parse do arquivo CSV via FormData
  // ---------------------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ message: 'Falha ao ler o corpo da requisição (multipart inválido).' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ message: 'Campo "file" obrigatório.' }, { status: 400 });
  }

  let csvText: string;
  try {
    csvText = await file.text();
  } catch {
    return NextResponse.json({ message: 'Falha ao ler o conteúdo do arquivo.' }, { status: 400 });
  }

  if (!csvText.trim()) {
    return NextResponse.json({ message: 'O arquivo CSV está vazio.' }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // 3. Parsear CSV e mapear colunas
  // ---------------------------------------------------------------------------
  const linhasCSV = parseCSV(csvText);
  if (linhasCSV.length < 2) {
    return NextResponse.json({ message: 'O CSV deve ter pelo menos uma linha de cabeçalho e um registro.' }, { status: 400 });
  }

  const [cabecalho, ...linhasDados] = linhasCSV;

  // Mapear índice de cada coluna reconhecida
  const indiceColuna: Record<string, number> = {};
  for (let col = 0; col < cabecalho.length; col++) {
    const campo = mapearColuna(cabecalho[col]);
    if (campo) indiceColuna[campo] = col;
  }

  if (!('nome' in indiceColuna)) {
    return NextResponse.json({ message: 'Coluna "Nome" obrigatória não encontrada no CSV.' }, { status: 400 });
  }
  if (!('email' in indiceColuna)) {
    return NextResponse.json({ message: 'Coluna "Email" obrigatória não encontrada no CSV.' }, { status: 400 });
  }
  if (!('cnpj' in indiceColuna)) {
    return NextResponse.json({ message: 'Coluna "CNPJ" obrigatória não encontrada no CSV.' }, { status: 400 });
  }

  function getCampo(linha: string[], campo: string): string {
    const idx = indiceColuna[campo];
    return idx !== undefined ? (linha[idx] ?? '').trim() : '';
  }

  // ---------------------------------------------------------------------------
  // 4. Validar cada linha com schema
  // ---------------------------------------------------------------------------
  interface LinhaValida {
    indiceOriginal: number;
    nome:           string;
    email:          string;
    cnpj:           string;
    phone?:         string;
    cnae?:          string;
    regimeTributario?: string;
  }

  const linhasValidas: LinhaValida[]            = [];
  const erros: Array<{ linha: number; motivo: string }> = [];

  for (let i = 0; i < linhasDados.length; i++) {
    const linha = linhasDados[i];
    const numeroLinha = i + 2; // +1 pelo cabeçalho, +1 por ser 1-indexed

    // Ignorar linhas completamente em branco
    if (linha.every((c) => c.trim() === '')) continue;

    const rawNome             = getCampo(linha, 'nome');
    const rawEmail            = getCampo(linha, 'email');
    const rawCnpj             = getCampo(linha, 'cnpj');
    const rawPhone            = getCampo(linha, 'phone');
    const rawCnae             = getCampo(linha, 'cnae');
    const rawRegime           = getCampo(linha, 'regimeTributario');

    const parsed = criarClienteSchema.safeParse({
      nome:             rawNome,
      email:            rawEmail,
      cnpj:             rawCnpj,
      phone:            rawPhone || undefined,
      cnae:             rawCnae  || undefined,
      regimeTributario: rawRegime || undefined,
    });

    if (!parsed.success) {
      const motivos = parsed.error.errors.map((e) => e.message).join('; ');
      erros.push({ linha: numeroLinha, motivo: motivos });
    } else {
      linhasValidas.push({
        indiceOriginal: numeroLinha,
        nome:             parsed.data.nome,
        email:            parsed.data.email,
        cnpj:             parsed.data.cnpj,
        phone:            parsed.data.phone,
        cnae:             parsed.data.cnae,
        regimeTributario: parsed.data.regimeTributario,
      });
    }
  }

  const totalLinhas = linhasDados.filter((l) => !l.every((c) => c.trim() === '')).length;

  if (linhasValidas.length === 0) {
    return NextResponse.json(
      { totalLinhas, sucesso: 0, falhas: erros.length, erros },
      { status: 200 },
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Checar limite de plano em batch
  // ---------------------------------------------------------------------------
  try {
    const limite = await checkClienteLimit(auth.sub);
    if (!limite.allowed) {
      return NextResponse.json(
        { message: `Limite de clientes atingido (${limite.current}/${limite.limit}). Faça upgrade para importar mais clientes.` },
        { status: 403 },
      );
    }

    if (limite.limit !== -1) {
      const disponiveis = limite.limit - limite.current;
      if (linhasValidas.length > disponiveis) {
        return NextResponse.json(
          {
            message: `Importação ultrapassaria o limite do plano. Você tem ${disponiveis} vagas disponíveis e está tentando importar ${linhasValidas.length} clientes.`,
          },
          { status: 403 },
        );
      }
    }
  } catch (err) {
    logger.error('[POST /clientes/importar] Erro ao verificar limite de plano.', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }

  // ---------------------------------------------------------------------------
  // 6. Checar duplicidade em batch
  // ---------------------------------------------------------------------------
  const emailsValidos = linhasValidas.map((l) => l.email.toLowerCase());
  const cnpjsValidos  = linhasValidas.map((l) => l.cnpj);

  const duplicados = await prisma.usuarioCliente.findMany({
    where: {
      deletedAt: null,
      OR: [
        { email: { in: emailsValidos } },
        { cnpj:  { in: cnpjsValidos  } },
      ],
    },
    select: { email: true, cnpj: true },
  });

  const emailsDup = new Set(duplicados.map((d) => d.email.toLowerCase()));
  const cnpjsDup  = new Set(duplicados.map((d) => d.cnpj ?? ''));

  const linhasParaCriar: LinhaValida[] = [];
  for (const lv of linhasValidas) {
    if (emailsDup.has(lv.email.toLowerCase())) {
      erros.push({ linha: lv.indiceOriginal, motivo: 'E-mail já cadastrado no sistema.' });
    } else if (cnpjsDup.has(lv.cnpj)) {
      erros.push({ linha: lv.indiceOriginal, motivo: 'CNPJ já cadastrado no sistema.' });
    } else {
      linhasParaCriar.push(lv);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Criar clientes em lotes de BATCH_SIZE
  // ---------------------------------------------------------------------------
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  let sucesso    = 0;

  interface ConviteItem {
    email:      string;
    nome:       string;
    inviteLink: string;
  }
  const convites: ConviteItem[] = [];

  for (let start = 0; start < linhasParaCriar.length; start += BATCH_SIZE) {
    const lote = linhasParaCriar.slice(start, start + BATCH_SIZE);

    await Promise.all(
      lote.map(async (lv) => {
        const inviteToken     = randomBytes(32).toString('hex');
        const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
        const emailLower      = lv.email.toLowerCase();
        const inviteLink      = `${appUrl}/auth/ativar-conta?token=${inviteToken}`;

        try {
          // Verifica soft-deleted com mesmo e-mail ou CNPJ
          const softDeleted = await prisma.usuarioCliente.findFirst({
            where: {
              deletedAt: { not: null },
              OR: [{ email: emailLower }, { cnpj: lv.cnpj }],
            },
            select: { id: true },
          });

          await prisma.$transaction(async (tx) => {
            let clienteId: string;

            if (softDeleted) {
              await tx.usuarioCliente.update({
                where: { id: softDeleted.id },
                data: {
                  name:             lv.nome,
                  email:            emailLower,
                  cnpj:             lv.cnpj,
                  phone:            lv.phone ?? null,
                  cnae:             lv.cnae  ?? null,
                  regimeTributario: lv.regimeTributario ?? null,
                  isActive:         false,
                  deletedAt:        null,
                  inviteToken,
                  inviteExpiresAt,
                },
              });
              clienteId = softDeleted.id;

              await tx.contadorCliente.upsert({
                where: { contadorId_clienteId: { contadorId: auth.sub, clienteId } },
                update: {},
                create: { contadorId: auth.sub, clienteId },
              });
            } else {
              const novoCliente = await tx.usuarioCliente.create({
                data: {
                  name:             lv.nome,
                  email:            emailLower,
                  cnpj:             lv.cnpj,
                  phone:            lv.phone ?? null,
                  cnae:             lv.cnae  ?? null,
                  regimeTributario: lv.regimeTributario ?? null,
                  inviteToken,
                  inviteExpiresAt,
                },
              });
              clienteId = novoCliente.id;

              await tx.contadorCliente.create({
                data: { contadorId: auth.sub, clienteId },
              });
            }
          });

          sucesso++;
          convites.push({ email: emailLower, nome: lv.nome, inviteLink });
        } catch (err) {
          const isPrismaUnique =
            err instanceof Error &&
            'code' in err &&
            (err as { code: string }).code === 'P2002';

          erros.push({
            linha:  lv.indiceOriginal,
            motivo: isPrismaUnique
              ? 'CNPJ ou e-mail duplicado (conflito de concorrência).'
              : 'Erro ao criar cliente.',
          });
          logger.error('[POST /clientes/importar] Erro ao criar cliente.', err instanceof Error ? err : undefined);
        }
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // 8. Enfileirar envio de convites via BullMQ (assíncrono)
  // ---------------------------------------------------------------------------
  if (convites.length > 0) {
    try {
      await queueProducer.add(
        'ENVIAR_CONVITES_IMPORTACAO',
        { tipo: 'ENVIAR_CONVITES_IMPORTACAO', payload: { convites } },
        {
          jobId: `ENVIAR_CONVITES_IMPORTACAO-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 86_400 },
          removeOnFail:     { count: 100 },
        },
      );
    } catch (queueErr) {
      logger.error('[POST /clientes/importar] Falha ao enfileirar convites.', queueErr instanceof Error ? queueErr : undefined);
      // Não falha a resposta — clientes já foram criados
    }
  }

  return NextResponse.json({
    totalLinhas,
    sucesso,
    falhas: erros.length,
    erros:  erros.sort((a, b) => a.linha - b.linha),
  });
}, ['ACCOUNTANT', 'ADMIN']);
