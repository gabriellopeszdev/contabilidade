import { NextResponse } from 'next/server';
import { withAuth }    from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }      from '../../../../../../../src/infrastructure/di/Container';
import { logger }      from '../../../../../../../src/utils/logger';
import { CoraService } from '../../../../../../../src/infrastructure/cora/CoraService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// PUT /api/v1/admin/contadores/:id/cora
//
// Salva ou remove as credenciais Cora (clientId + certificado mTLS) do contador.
// Valida as credenciais contra a API Cora antes de persistir.
//
// Body: {
//   clientId:       string   — OAuth client_id do Cora (vazio para remover)
//   certificatePem: string   — Certificado TLS em formato PEM
//   privateKeyPem:  string   — Chave privada TLS em formato PEM
// }
//
// Acesso: role ADMIN apenas
// =============================================================================

export const PUT = withAuth(async (req, ctx, _auth) => {
  try {
    const contadorId = (ctx.params as { id: string }).id;

    const body = await req.json() as {
      clientId?:       string;
      certificatePem?: string;
      privateKeyPem?:  string;
    };

    const clientId       = (body.clientId       ?? '').trim();
    const certificatePem = (body.certificatePem ?? '').trim();
    const privateKeyPem  = (body.privateKeyPem  ?? '').trim();

    // Verifica se o contador existe
    const contador = await prisma.usuarioContador.findFirst({
      where:  { id: contadorId, deletedAt: null },
      select: { id: true },
    });
    if (!contador) {
      return NextResponse.json({ message: 'Contador não encontrado.' }, { status: 404 });
    }

    // Se enviou credenciais, valida antes de salvar
    if (clientId) {
      if (!certificatePem || !privateKeyPem) {
        return NextResponse.json(
          { message: 'Para configurar o Cora, envie clientId, certificatePem e privateKeyPem.' },
          { status: 400 },
        );
      }

      const svc = new CoraService(clientId, certificatePem, privateKeyPem);
      const validacao = await svc.validarCredenciais();
      if (!validacao.ok) {
        return NextResponse.json(
          { message: `Credenciais Cora inválidas: ${validacao.erro ?? 'verifique o clientId e os certificados.'}` },
          { status: 400 },
        );
      }
    }

    // Upsert da configuração
    await prisma.configuracaoEscritorio.upsert({
      where:  { contadorId },
      update: {
        coraClientId:       clientId       || null,
        coraCertificatePem: certificatePem || null,
        coraPrivateKeyPem:  privateKeyPem  || null,
      },
      create: {
        contadorId,
        nomeEscritorio:     'Escritório Contábil',
        coraClientId:       clientId       || null,
        coraCertificatePem: certificatePem || null,
        coraPrivateKeyPem:  privateKeyPem  || null,
      },
    });

    logger.info('[PUT /admin/contadores/:id/cora] Credenciais Cora salvas.', { contadorId });

    return NextResponse.json({
      ok:         true,
      configurado: Boolean(clientId),
    });
  } catch (err) {
    logger.error('[PUT /admin/contadores/:id/cora] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);

// =============================================================================
// DELETE /api/v1/admin/contadores/:id/cora — Remove credenciais Cora
// =============================================================================

export const DELETE = withAuth(async (_req, ctx, _auth) => {
  try {
    const contadorId = (ctx.params as { id: string }).id;

    await prisma.configuracaoEscritorio.updateMany({
      where: { contadorId },
      data: {
        coraClientId:       null,
        coraCertificatePem: null,
        coraPrivateKeyPem:  null,
      },
    });

    logger.info('[DELETE /admin/contadores/:id/cora] Credenciais removidas.', { contadorId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /admin/contadores/:id/cora] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ADMIN']);
