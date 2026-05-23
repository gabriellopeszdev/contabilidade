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
// GET /api/v1/dashboard/stats
//
// Retorna contadores rápidos para o Dashboard do Contador:
//   - tarefasPendentes:         total de tarefas que NÃO estão DONE
//   - documentosNaoLidos:       total de documentos com readStatus = false
//   - clientesAtivos:           total de clientes ativos vinculados ao contador
//   - novosDocumentosRecebidos: documentos enviados por clientes (últimas 24h)
//
// Todas as queries usam COUNT (sem carregar registros na memória).
//
// Respostas:
//   200 OK → { tarefasPendentes, documentosNaoLidos, clientesAtivos, novosDocumentosRecebidos }
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    // Clientes do contador — escopo para todas as queries
    const vinculos = await prisma.contadorCliente.findMany({
      where:  { contadorId },
      select: { clienteId: true },
    });
    const meusClienteIds = vinculos.map((v) => v.clienteId);

    // Execução paralela das 4 contagens — máxima performance
    const [tarefasPendentes, documentosNaoLidos, clientesAtivos, novosDocumentosRecebidos] =
      await Promise.all([
        // 1. Tarefas pendentes dos clientes deste contador
        prisma.tarefaKanban.count({
          where: {
            currentState: { not: 'DONE' },
            clientId:     { in: meusClienteIds },
          },
        }),

        // 2. Documentos não lidos dos clientes deste contador
        prisma.documentoFiscal.count({
          where: {
            readStatus: false,
            deletedAt:  null,
            clientId:   { in: meusClienteIds },
          },
        }),

        // 3. Clientes ativos vinculados ao contador logado
        prisma.contadorCliente.count({
          where: {
            contadorId,
            cliente: {
              isActive:  true,
              deletedAt: null,
            },
          },
        }),

        // 4. Documentos recebidos dos clientes deste contador nas últimas 24h
        prisma.documentoFiscal.count({
          where: {
            createdAt: { gte: ontem },
            deletedAt: null,
            clientId:  { in: meusClienteIds },
          },
        }),
      ]);

    return NextResponse.json({
      tarefasPendentes,
      documentosNaoLidos,
      clientesAtivos,
      novosDocumentosRecebidos,
    });
  } catch (err) {
    logger.error('[GET /dashboard/stats] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Erro interno do servidor.' },
      { status: 500 },
    );
  }
}, ['ACCOUNTANT', 'ADMIN', 'EMPLOYEE']);
