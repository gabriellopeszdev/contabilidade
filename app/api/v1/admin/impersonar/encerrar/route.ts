import { NextRequest, NextResponse } from 'next/server';

import { prisma }   from '../../../../../../src/infrastructure/di/Container';
import { logger }   from '../../../../../../src/utils/logger';
import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/admin/impersonar/encerrar
//
// Registra o encerramento de uma sessão de impersonação no AuditLog.
// Não há restrição de role porque quem chama este endpoint é o admin
// já impersonado como contador (role = ACCOUNTANT). A identidade do admin
// original é lida da claim `impersonadoPor` do próprio token de impersonação.
//
// A troca de volta para o token do admin acontece no client — este endpoint
// apenas grava o log de encerramento.
// =============================================================================

export const POST = withAuth(async (
  req: NextRequest,
  _ctx: { params: Record<string, string> },
  auth,
): Promise<NextResponse> => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? '0.0.0.0';
  const adminOriginalId = auth.impersonadoPor;

  if (!adminOriginalId) {
    return NextResponse.json(
      { message: 'Esta sessão não é uma sessão de impersonação.' },
      { status: 400 },
    );
  }

  prisma.auditLog.create({
    data: {
      userId:       adminOriginalId,
      actionType:   'IMPERSONATION_FINALIZADA',
      resourceType: 'USER',
      detailsJson:  { contadorAlvoId: auth.sub },
      ipAddress:    ip,
    },
  }).catch((err: unknown) => {
    logger.warn('[POST /admin/impersonar/encerrar] Falha ao gravar AuditLog', {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return NextResponse.json({ ok: true });
});
