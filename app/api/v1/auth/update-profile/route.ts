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
// PATCH /api/v1/auth/update-profile
//
// Atualiza os dados de perfil do contador logado (nome, email, phone, crc).
// Apenas campos enviados são atualizados (merge parcial).
//
// Respostas:
//   200 OK           → { message, usuario }
//   400 Bad Request  → validação
//   401 Unauthorized → tratado pelo withAuth
//   409 Conflict     → email ou CRC já em uso
//   500 Internal     → erro de servidor
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const { nome, email, phone, crc } = body as {
      nome?:  string;
      email?: string;
      phone?: string;
      crc?:   string;
    };

    // -----------------------------------------------------------------------
    // Validação
    // -----------------------------------------------------------------------
    const erros: string[] = [];

    if (nome !== undefined && (typeof nome !== 'string' || nome.trim().length < 2)) {
      erros.push('Nome deve ter pelo menos 2 caracteres.');
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
        erros.push('E-mail inválido.');
      }
    }

    if (crc !== undefined && (typeof crc !== 'string' || crc.trim().length < 5)) {
      erros.push('CRC deve ter pelo menos 5 caracteres.');
    }

    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
      erros.push('Telefone inválido.');
    }

    if (erros.length > 0) {
      return NextResponse.json({ message: erros.join(' ') }, { status: 400 });
    }

    // -----------------------------------------------------------------------
    // Verificação de unicidade (email / CRC)
    // -----------------------------------------------------------------------
    if (email) {
      const emailExiste = await prisma.usuarioContador.findFirst({
        where: { email: email.toLowerCase().trim(), id: { not: auth.sub } },
        select: { id: true },
      });
      if (emailExiste) {
        return NextResponse.json(
          { message: 'Este e-mail já está em uso por outro usuário.' },
          { status: 409 },
        );
      }
    }

    if (crc) {
      const crcExiste = await prisma.usuarioContador.findFirst({
        where: { crc: crc.trim(), id: { not: auth.sub } },
        select: { id: true },
      });
      if (crcExiste) {
        return NextResponse.json(
          { message: 'Este CRC já está em uso por outro contador.' },
          { status: 409 },
        );
      }
    }

    // -----------------------------------------------------------------------
    // Atualização parcial
    // -----------------------------------------------------------------------
    const data: Record<string, unknown> = {};
    if (nome  !== undefined) data.name  = nome.trim();
    if (email !== undefined) data.email = email.toLowerCase().trim();
    if (phone !== undefined) data.phone = phone ? phone.trim() : null;
    if (crc   !== undefined) data.crc   = crc.trim();

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { message: 'Nenhum campo para atualizar.' },
        { status: 400 },
      );
    }

    const atualizado = await prisma.usuarioContador.update({
      where: { id: auth.sub },
      data,
      select: {
        id:        true,
        name:      true,
        email:     true,
        crc:       true,
        phone:     true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      message: 'Perfil atualizado com sucesso.',
      usuario: atualizado,
    });
  } catch (err) {
    logger.error('[PATCH /auth/update-profile] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN']);
