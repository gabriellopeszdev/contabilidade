import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma }                from '../../../../../src/infrastructure/di/Container';
import { logger }                from '../../../../../src/utils/logger';
import { BcryptPasswordHasher }  from '../../../../../src/infrastructure/auth/BcryptPasswordHasher';
import { withAuth }              from '../../../../../src/infrastructure/http/middlewares/withAuth';
import type { RouteContext }     from '../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/admin/contadores
//
// Lista todos os contadores cadastrados com:
//   - Dados do usuário (id, name, email, crc, isActive, createdAt)
//   - Contagem de clientes associados (carteira)
//   - Nome do escritório (ConfiguracaoEscritorio, se houver)
//
// Acesso: role ADMIN apenas (enforçado por withAuth)
// =============================================================================

export const GET = withAuth(async (_req: NextRequest, _ctx: RouteContext) => {
  try {
    const contadores = await prisma.usuarioContador.findMany({
      where:   { deletedAt: null, isAdmin: false }, // nunca exibe outros admins
      orderBy: { createdAt: 'desc' },
      select: {
        id:          true,
        name:        true,
        email:       true,
        crc:         true,
        isActive:    true,
        createdAt:   true,
        _count: {
          select: { clientesRel: true },
        },
        configuracao: {
          select: { nomeEscritorio: true, cnpjEscritorio: true, asaasApiKey: true, coraClientId: true, iaApiKey: true, iaProvider: true, providerAssinatura: true },
        },
        assinaturaSaaS: {
          select: { status: true, dataRenovacao: true, plano: { select: { id: true, nome: true } } },
        },
      },
    });

    const items = contadores.map((c) => ({
      id:                c.id,
      name:              c.name,
      email:             c.email,
      crc:               c.crc,
      isActive:          c.isActive,
      totalClientes:     c._count.clientesRel,
      nomeEscritorio:    c.configuracao?.nomeEscritorio ?? null,
      cnpjEscritorio:    c.configuracao?.cnpjEscritorio ?? null,
      asaasConfigurado:  Boolean(c.configuracao?.asaasApiKey),
      coraConfigurado:   Boolean(c.configuracao?.coraClientId),
      iaPersonalizada:   Boolean(c.configuracao?.iaApiKey),
      iaProvider:        c.configuracao?.iaProvider ?? null,
      providerAssinatura: c.configuracao?.providerAssinatura ?? 'INTERNO',
      createdAt:         c.createdAt.toISOString(),
      planoId:           c.assinaturaSaaS?.plano.id ?? null,
      planoNome:         c.assinaturaSaaS?.plano.nome ?? null,
      statusAssinatura:  c.assinaturaSaaS?.status ?? null,
      dataRenovacao:     c.assinaturaSaaS?.dataRenovacao?.toISOString() ?? null,
    }));

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    logger.error('[GET /admin/contadores] Erro interno', err instanceof Error ? err : { err });
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ADMIN']);

// =============================================================================
// POST /api/v1/admin/contadores
//
// Cria um novo UsuarioContador + ConfiguracaoEscritorio em uma transação.
//
// Body JSON:
//   { name, email, crc, senhaProvisoria, nomeEscritorio, cnpjEscritorio? }
//
// Acesso: role ADMIN apenas
// =============================================================================

const CriarContadorSchema = z.object({
  tipo:            z.enum(['AUTONOMO', 'EMPRESA']),
  name:            z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(255),
  email:           z.string().email('E-mail inválido.').toLowerCase(),
  crc:             z.string().optional().or(z.literal('')),
  senhaProvisoria: z.string().min(8, 'Senha deve ter ao menos 8 caracteres.'),
  nomeEscritorio:  z.string().min(2, 'Nome do escritório deve ter ao menos 2 caracteres.').max(255),
  cnpjEscritorio:  z.string().optional().or(z.literal('')),
  planoId:         z.string().uuid().optional(),
  providerAssinatura: z.enum(['INTERNO', 'DOCSEAL', 'SIGNATUREAPI']).optional(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'AUTONOMO') {
    if (!data.crc || !data.crc.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['crc'],
        message: 'CRC é obrigatório para Contador Autônomo.',
      });
    } else if (!/^CRC-[A-Z]{2}\/\d{1,9}$/i.test(data.crc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['crc'],
        message: 'CRC deve estar no formato CRC-UF/NUMERO (ex: CRC-SP/123456).',
      });
    }
  } else if (data.tipo === 'EMPRESA') {
    if (!data.cnpjEscritorio || !data.cnpjEscritorio.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cnpjEscritorio'],
        message: 'CNPJ do escritório é obrigatório para Empresa de Contabilidade.',
      });
    } else if (data.cnpjEscritorio.replace(/\D/g, '').length !== 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cnpjEscritorio'],
        message: 'CNPJ do escritório deve ter exatamente 14 dígitos.',
      });
    }

    if (data.crc && data.crc.trim() && !/^CRC-[A-Z]{2}\/\d{1,9}$/i.test(data.crc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['crc'],
        message: 'CRC deve estar no formato CRC-UF/NUMERO (ex: CRC-SP/123456).',
      });
    }
  }
});

const hasher = new BcryptPasswordHasher();

export const POST = withAuth(async (req: NextRequest, _ctx: RouteContext) => {
  // --------------------------------------------------------------------------
  // 1. Validação do body
  // --------------------------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Body deve ser JSON válido.' }, { status: 400 });
  }

  const parse = CriarContadorSchema.safeParse(body);
  if (!parse.success) {
    const erros = parse.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
    return NextResponse.json({ message: 'Dados inválidos.', erros }, { status: 422 });
  }

  const { tipo, name, email, crc, senhaProvisoria, nomeEscritorio, cnpjEscritorio, planoId, providerAssinatura } = parse.data;

  const crcValue = crc && crc.trim() ? crc.trim().toUpperCase() : null;
  const cnpjValue = cnpjEscritorio && cnpjEscritorio.trim() ? cnpjEscritorio.replace(/\D/g, '') : null;

  // --------------------------------------------------------------------------
  // 2. Verificar unicidade de e-mail e CRC
  // --------------------------------------------------------------------------
  try {
    const [emailExiste, crcExiste] = await Promise.all([
      prisma.usuarioContador.findFirst({ where: { email, deletedAt: null } }),
      crcValue
        ? prisma.usuarioContador.findFirst({ where: { crc: crcValue, deletedAt: null } })
        : Promise.resolve(null),
    ]);

    if (emailExiste) {
      return NextResponse.json({ message: 'E-mail já cadastrado.' }, { status: 409 });
    }
    if (crcExiste) {
      return NextResponse.json({ message: 'CRC já cadastrado.' }, { status: 409 });
    }
  } catch (err) {
    logger.error('[POST /admin/contadores] Erro ao verificar unicidade', err instanceof Error ? err : { err });
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }

  // --------------------------------------------------------------------------
  // 3. Hash da senha provisória
  // --------------------------------------------------------------------------
  const passwordHash = await hasher.hash(senhaProvisoria);

  // --------------------------------------------------------------------------
  // 4. Criação atômica: UsuarioContador + ConfiguracaoEscritorio
  // --------------------------------------------------------------------------
  try {
    const contador = await prisma.$transaction(async (tx) => {
      const novoContador = await tx.usuarioContador.create({
        data: {
          name,
          email,
          crc:          crcValue,
          passwordHash,
          isActive:     true,
          isAdmin:      false,
        },
      });

      await tx.configuracaoEscritorio.create({
        data: {
          contadorId:     novoContador.id,
          nomeEscritorio,
          cnpjEscritorio: cnpjValue,
          providerAssinatura: providerAssinatura ?? 'INTERNO',
        },
      });

      // Cria assinatura TRIAL de 7 dias no plano escolhido (ou mais barato se não informado)
      const planoTrial = planoId
        ? await tx.planoSaaS.findUnique({ where: { id: planoId } })
        : await tx.planoSaaS.findFirst({ orderBy: { preco: 'asc' } });
      if (planoTrial) {
        await tx.assinaturaSaaS.create({
          data: {
            escritorioId:  novoContador.id,
            planoId:       planoTrial.id,
            status:        'TRIAL',
            dataRenovacao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            valorMensal:   planoTrial.preco,
          },
        });
      }

      return novoContador;
    });

    logger.info('[POST /admin/contadores] Contador criado.', {
      contadorId: contador.id,
      email:      contador.email,
    });

    return NextResponse.json(
      {
        id:    contador.id,
        name:  contador.name,
        email: contador.email,
        crc:   contador.crc,
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[POST /admin/contadores] Erro ao criar contador', err instanceof Error ? err : { err });
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ADMIN']);
