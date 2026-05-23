import { NextResponse } from 'next/server';

import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }   from '../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../src/utils/logger';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/auth/me
//
// Rota protegida — retorna os dados sanitizados do usuário logado.
// Usada pelo front-end no carregamento inicial (F5) para restaurar sessão.
//
// Respostas:
//   200 OK          → { usuario }
//   401 Unauthorized→ token ausente/inválido (tratado pelo withAuth)
//   404 Not Found   → usuário do token não existe mais no banco
//   500 Internal    → erro de servidor
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    if (auth.role === 'ACCOUNTANT' || auth.role === 'ADMIN') {
      const contador = await prisma.usuarioContador.findUnique({
        where: { id: auth.sub },
        select: {
          id:        true,
          name:      true,
          email:     true,
          crc:       true,
          phone:     true,
          avatarUrl: true,
          isActive:  true,
          createdAt: true,
        },
      });

      if (!contador || !contador.isActive) {
        return NextResponse.json(
          { message: 'Usuário não encontrado.' },
          { status: 404 },
        );
      }

      return NextResponse.json({
        usuario: {
          ...contador,
          role: auth.role,
          createdAt: contador.createdAt.toISOString(),
        },
      });
    }

    // role === 'EMPLOYEE'
    if (auth.role === 'EMPLOYEE') {
      const funcionario = await prisma.funcionario.findUnique({
        where: { id: auth.sub },
        select: {
          id:        true,
          name:      true,
          email:     true,
          phone:     true,
          avatarUrl: true,
          isActive:  true,
          setores:   true,
          vinculo:   true,
          contadorId: true,
          clienteId:  true,
          createdAt: true,
        },
      });

      if (!funcionario || !funcionario.isActive) {
        return NextResponse.json(
          { message: 'Usuário não encontrado.' },
          { status: 404 },
        );
      }

      return NextResponse.json({
        usuario: {
          ...funcionario,
          role: 'EMPLOYEE',
          superiorId: funcionario.contadorId ?? funcionario.clienteId,
          createdAt: funcionario.createdAt.toISOString(),
        },
      });
    }

    // role === 'CLIENT'
    const cliente = await prisma.usuarioCliente.findUnique({
      where: { id: auth.sub },
      select: {
        id:        true,
        name:      true,
        email:     true,
        cnpj:      true,
        phone:     true,
        avatarUrl: true,
        isActive:  true,
        createdAt: true,
      },
    });

    if (!cliente || !cliente.isActive) {
      return NextResponse.json(
        { message: 'Usuário não encontrado.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      usuario: {
        ...cliente,
        role: auth.role,
        createdAt: cliente.createdAt.toISOString(),
      },
    });
  } catch (err) {
    logger.error('[GET /auth/me] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
});
