import { NextResponse } from 'next/server';
import { withAuth } from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../src/utils/logger';
import { getPlanInfo, hasFeature, FEATURES } from '../../../../src/utils/planLimits';
import { checkRateLimit } from '../../../../src/utils/rateLimiter';
import { BcryptPasswordHasher } from '../../../../src/infrastructure/auth/BcryptPasswordHasher';
import { SenhaHash } from '../../../../src/domain/value-objects/SenhaHash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hasher = new BcryptPasswordHasher();

const SETORES_VALIDOS = ['FISCAL', 'PESSOAL', 'CONTABIL', 'TODOS'];

// =============================================================================
// GET /api/v1/equipe — Lista funcionários do escritório do contador autenticado
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const funcionarios = await prisma.funcionario.findMany({
      where: {
        contadorId: auth.sub,
        deletedAt:  null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id:        true,
        name:      true,
        email:     true,
        phone:     true,
        setores:   true,
        vinculo:   true,
        isActive:  true,
        createdAt: true,
      },
    });

    return NextResponse.json({ funcionarios });
  } catch (err) {
    logger.error('[GET /equipe] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);

// =============================================================================
// POST /api/v1/equipe — Cadastra novo funcionário
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  const rl = await checkRateLimit(`write:equipe:${auth.sub}`, 20, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas requisições. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

  try {
    const plan = await getPlanInfo(auth.sub);
    if (!hasFeature(plan, FEATURES.EQUIPE)) {
      return NextResponse.json(
        { message: 'O recurso de Equipe não está disponível no seu plano. Faça upgrade para o Plano Pro ou superior.' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { name, email, senha, phone, setores } = body as {
      name?: string;
      email?: string;
      senha?: string;
      phone?: string;
      setores?: string[];
    };

    if (!name?.trim() || !email?.trim() || !senha) {
      return NextResponse.json(
        { message: 'Nome, e-mail e senha são obrigatórios.' },
        { status: 400 },
      );
    }

    if (!setores || setores.length === 0) {
      return NextResponse.json(
        { message: 'Selecione pelo menos um setor.' },
        { status: 400 },
      );
    }

    const setoresInvalidos = setores.filter((s) => !SETORES_VALIDOS.includes(s));
    if (setoresInvalidos.length > 0) {
      return NextResponse.json(
        { message: `Setores inválidos: ${setoresInvalidos.join(', ')}` },
        { status: 400 },
      );
    }

    // Verifica duplicidade de email em todas as tabelas de usuário
    const [existeContador, existeCliente, existeFunc] = await Promise.all([
      prisma.usuarioContador.findFirst({ where: { email: email.trim().toLowerCase() } }),
      prisma.usuarioCliente.findFirst({ where: { email: email.trim().toLowerCase() } }),
      prisma.funcionario.findFirst({ where: { email: email.trim().toLowerCase(), deletedAt: null } }),
    ]);

    if (existeContador || existeCliente || existeFunc) {
      return NextResponse.json(
        { message: 'Este e-mail já está cadastrado no sistema.' },
        { status: 409 },
      );
    }

    const senhaHash = await SenhaHash.criarDeTextoPlano(senha, hasher);

    const funcionario = await prisma.funcionario.create({
      data: {
        name:         name.trim(),
        email:        email.trim().toLowerCase(),
        passwordHash: senhaHash.hash,
        phone:        phone?.trim() || null,
        vinculo:      'ESCRITORIO',
        contadorId:   auth.sub,
        setores:      setores as ('FISCAL' | 'PESSOAL' | 'CONTABIL' | 'TODOS')[],
        isActive:     true,
      },
      select: {
        id:       true,
        name:     true,
        email:    true,
        phone:    true,
        setores:  true,
        vinculo:  true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ funcionario }, { status: 201 });
  } catch (err) {
    logger.error('[POST /equipe] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro ao cadastrar funcionário.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'ADMIN']);
