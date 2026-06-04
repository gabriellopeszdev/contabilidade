import { NextRequest, NextResponse } from 'next/server';

import { withAuth }        from '../../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '../../../../../../../src/infrastructure/di/Container';
import { parseNFe }        from '../../../../../../../src/utils/nfeParser';
import { logger }          from '../../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/nfe/recebidas/[id]/visualizar
//
// Baixa o XML de uma NF-e do MinIO no servidor e retorna os dados parseados.
// O browser nunca toca a URL interna do MinIO (minio:9000).
//
// Roles: ACCOUNTANT | EMPLOYEE
// =============================================================================

export const GET = withAuth(
  async (req: NextRequest, ctx, auth): Promise<NextResponse> => {
    const id = (ctx?.params as { id?: string })?.id;
    if (!id) {
      return NextResponse.json({ message: 'ID inválido.' }, { status: 400 });
    }

    try {
      const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

      // 1. Busca o documento e valida acesso (cliente deve pertencer ao contador)
      const doc = await prisma.documentoFiscal.findFirst({
        where: {
          id,
          deletedAt: null,
          fileType:  'XML',
          cliente: {
            contadoresRel: { some: { contadorId } },
          },
        },
        select: { storagePath: true, fileName: true },
      });

      if (!doc) {
        return NextResponse.json({ message: 'NF-e não encontrada.' }, { status: 404 });
      }

      // 2. Baixa o XML do MinIO server-side (alcança minio:9000 via rede interna)
      const buffer = await storageService.getBuffer(doc.storagePath);
      // Remove BOM UTF-8 se presente
      const xmlString = buffer.toString('utf-8').replace(/^﻿/, '');

      // 3. Parseia o XML
      const dados = parseNFe(xmlString);

      return NextResponse.json({
        nomeArquivo: doc.fileName,
        ok:          true,
        dados,
      });
    } catch (err) {
      logger.error('[GET /nfe/recebidas/[id]/visualizar] Erro', err instanceof Error ? err : undefined);
      const msg = err instanceof Error ? err.message : 'Erro ao processar o XML.';
      return NextResponse.json({ nomeArquivo: '', ok: false, erro: msg }, { status: 500 });
    }
  },
  ['ACCOUNTANT', 'EMPLOYEE'],
);
