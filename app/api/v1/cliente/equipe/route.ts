import { NextResponse } from 'next/server';
import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../src/utils/logger';
import { BcryptPasswordHasher } from '../../../../../src/infrastructure/auth/BcryptPasswordHasher';
import { SenhaHash } from '../../../../../src/domain/value-objects/SenhaHash';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hasher = new BcryptPasswordHasher();
const SETORES_VALIDOS = ['FISCAL', 'PESSOAL', 'CONTABIL', 'TODOS'];

// =============================================================================
// GET /api/v1/cliente/equipe — Lista membros da equipe da empresa
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const funcionarios = await prisma.funcionario.findMany({
      where:   { clienteId: auth.sub, deletedAt: null },
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
    logger.error('[GET /cliente/equipe] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['CLIENT']);

// =============================================================================
// POST /api/v1/cliente/equipe — Cadastra membro da equipe da empresa
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  try {
    const body = await req.json();
    const { name, email, senha, phone, setores } = body as {
      name?:    string;
      email?:   string;
      senha?:   string;
      phone?:   string;
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

    const emailNorm = email.trim().toLowerCase();

    const [existeContador, existeCliente, existeFunc] = await Promise.all([
      prisma.usuarioContador.findFirst({ where: { email: emailNorm } }),
      prisma.usuarioCliente.findFirst({ where: { email: emailNorm } }),
      prisma.funcionario.findFirst({ where: { email: emailNorm, deletedAt: null } }),
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
        email:        emailNorm,
        passwordHash: senhaHash.hash,
        phone:        phone?.trim() || null,
        vinculo:      'CLIENTE',
        clienteId:    auth.sub,
        setores:      setores as ('FISCAL' | 'PESSOAL' | 'CONTABIL' | 'TODOS')[],
        isActive:     true,
      },
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

    return NextResponse.json({ funcionario }, { status: 201 });
  } catch (err) {
    logger.error('[POST /cliente/equipe] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro ao cadastrar membro.' }, { status: 500 });
  }
}, ['CLIENT']);
