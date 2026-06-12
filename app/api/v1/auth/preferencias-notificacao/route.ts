import { NextResponse }                from 'next/server';
import { withAuth }                    from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                      from '../../../../../src/infrastructure/di/Container';
import { logger }                      from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/auth/preferencias-notificacao
// Retorna as preferências de notificação do usuário autenticado.
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    if (auth.role === 'ACCOUNTANT' || auth.role === 'ADMIN') {
      const contador = await prisma.usuarioContador.findUnique({
        where:  { id: auth.sub },
        select: { notifEmailNovoDoc: true },
      });
      if (!contador) return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
      return NextResponse.json({ notifEmailNovoDoc: contador.notifEmailNovoDoc });
    }

    if (auth.role === 'CLIENT') {
      const cliente = await prisma.usuarioCliente.findUnique({
        where:  { id: auth.sub },
        select: { notifEmailNovoDoc: true, notifEmailBoleto: true },
      });
      if (!cliente) return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
      return NextResponse.json({
        notifEmailNovoDoc: cliente.notifEmailNovoDoc,
        notifEmailBoleto:  cliente.notifEmailBoleto,
      });
    }

    return NextResponse.json({ message: 'Role não suportada.' }, { status: 403 });
  } catch (err) {
    logger.error('[GET /preferencias-notificacao] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);

// =============================================================================
// PATCH /api/v1/auth/preferencias-notificacao
// Atualiza as preferências de notificação do usuário autenticado.
//
// Body (todos opcionais, pelo menos um obrigatório):
//   notifEmailNovoDoc?: boolean  — Contador e Cliente
//   notifEmailBoleto?:  boolean  — Somente Cliente
// =============================================================================

export const PATCH = withAuth(async (req, _ctx, auth) => {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: 'JSON inválido.' }, { status: 400 });
    }

    const { notifEmailNovoDoc, notifEmailBoleto } = body as {
      notifEmailNovoDoc?: unknown;
      notifEmailBoleto?:  unknown;
    };

    if (notifEmailNovoDoc !== undefined && typeof notifEmailNovoDoc !== 'boolean') {
      return NextResponse.json({ message: 'notifEmailNovoDoc deve ser boolean.' }, { status: 400 });
    }
    if (notifEmailBoleto !== undefined && typeof notifEmailBoleto !== 'boolean') {
      return NextResponse.json({ message: 'notifEmailBoleto deve ser boolean.' }, { status: 400 });
    }

    if (notifEmailNovoDoc === undefined && notifEmailBoleto === undefined) {
      return NextResponse.json({ message: 'Nenhum campo para atualizar.' }, { status: 400 });
    }

    if (auth.role === 'ACCOUNTANT' || auth.role === 'ADMIN') {
      if (notifEmailBoleto !== undefined) {
        return NextResponse.json({ message: 'notifEmailBoleto não se aplica ao contador.' }, { status: 400 });
      }
      const data: Record<string, boolean> = {};
      if (notifEmailNovoDoc !== undefined) data.notifEmailNovoDoc = notifEmailNovoDoc;

      await prisma.usuarioContador.update({ where: { id: auth.sub }, data });
      return NextResponse.json({ message: 'Preferências atualizadas.', ...data });
    }

    if (auth.role === 'CLIENT') {
      const data: Record<string, boolean> = {};
      if (notifEmailNovoDoc !== undefined) data.notifEmailNovoDoc = notifEmailNovoDoc;
      if (notifEmailBoleto  !== undefined) data.notifEmailBoleto  = notifEmailBoleto;

      await prisma.usuarioCliente.update({ where: { id: auth.sub }, data });
      return NextResponse.json({ message: 'Preferências atualizadas.', ...data });
    }

    return NextResponse.json({ message: 'Role não suportada.' }, { status: 403 });
  } catch (err) {
    logger.error('[PATCH /preferencias-notificacao] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);
