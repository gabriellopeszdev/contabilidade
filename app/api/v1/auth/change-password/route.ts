import { NextResponse } from 'next/server';

import { withAuth }              from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                from '../../../../../src/infrastructure/di/Container';
import { logger }                from '../../../../../src/utils/logger';
import { BcryptPasswordHasher }  from '../../../../../src/infrastructure/auth/BcryptPasswordHasher';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PATCH /api/v1/auth/change-password
//
// Altera a senha do usuário logado. Exige a senha atual para segurança.
//
// Body JSON:
//   { senhaAtual: string, novaSenha: string, confirmarSenha: string }
//
// Respostas:
//   200 OK           → { message }
//   400 Bad Request  → validação (senhas não conferem, muito curta, etc.)
//   401 Unauthorized → tratado pelo withAuth
//   403 Forbidden    → senha atual incorreta
//   500 Internal     → erro de servidor
// =============================================================================

const hasher = new BcryptPasswordHasher();
const SENHA_MIN_LEN = 8;

export const PATCH = withAuth(async (req, _ctx, auth) => {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: 'Corpo da requisição deve ser JSON válido.' },
        { status: 400 },
      );
    }

    const { senhaAtual, novaSenha, confirmarSenha } = body as {
      senhaAtual?:     string;
      novaSenha?:      string;
      confirmarSenha?: string;
    };

    // -----------------------------------------------------------------------
    // Validação
    // -----------------------------------------------------------------------
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      return NextResponse.json(
        { message: 'Todos os campos são obrigatórios (senhaAtual, novaSenha, confirmarSenha).' },
        { status: 400 },
      );
    }

    if (novaSenha.length < SENHA_MIN_LEN) {
      return NextResponse.json(
        { message: `A nova senha deve ter pelo menos ${SENHA_MIN_LEN} caracteres.` },
        { status: 400 },
      );
    }

    if (novaSenha !== confirmarSenha) {
      return NextResponse.json(
        { message: 'A nova senha e a confirmação não conferem.' },
        { status: 400 },
      );
    }

    if (senhaAtual === novaSenha) {
      return NextResponse.json(
        { message: 'A nova senha deve ser diferente da senha atual.' },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------------
    // Buscar hash atual do banco
    // -----------------------------------------------------------------------
    const repo = auth.role === 'ACCOUNTANT' || auth.role === 'ADMIN'
      ? prisma.usuarioContador
      : prisma.usuarioCliente;

    const usuario = await repo.findUnique({
      where: { id: auth.sub },
      select: { passwordHash: true },
    });

    if (!usuario) {
      return NextResponse.json(
        { message: 'Usuário não encontrado.' },
        { status: 404 },
      );
    }

    // -----------------------------------------------------------------------
    // Verificar senha atual
    // -----------------------------------------------------------------------
    const senhaCorreta = await hasher.comparar(senhaAtual, usuario.passwordHash);
    if (!senhaCorreta) {
      return NextResponse.json(
        { message: 'Senha atual incorreta.' },
        { status: 403 },
      );
    }

    // -----------------------------------------------------------------------
    // Gerar novo hash e atualizar
    // -----------------------------------------------------------------------
    const novoHash = await hasher.hash(novaSenha);

    await repo.update({
      where: { id: auth.sub },
      data:  { passwordHash: novoHash },
    });

    return NextResponse.json({
      message: 'Senha alterada com sucesso.',
    });
  } catch (err) {
    logger.error('[PATCH /auth/change-password] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN', 'CLIENT']);
