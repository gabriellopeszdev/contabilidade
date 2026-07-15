import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

import { withAuth, type ResolvedRouteContext } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma } from '../../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKUP_ROOT = '/backups';
const CATEGORIAS = ['daily', 'weekly', 'monthly'];

export const GET = withAuth(async (req: NextRequest, _ctx: ResolvedRouteContext, auth) => {
  const { searchParams } = req.nextUrl;
  const file = searchParams.get('file');

  if (!file) {
    return NextResponse.json({ message: 'Parâmetro "file" obrigatório.' }, { status: 400 });
  }

  // Segurança: rejeitar se o nome contém '/' ou '..'
  if (file.includes('/') || file.includes('\\') || file.includes('..')) {
    return NextResponse.json({ message: 'Nome de arquivo inválido.' }, { status: 400 });
  }

  // Procurar o arquivo nas 3 categorias
  let resolvedPath: string | null = null;
  for (const cat of CATEGORIAS) {
    const candidate = path.resolve(BACKUP_ROOT, cat, file);
    // Verificar que o caminho resolvido ainda está dentro de BACKUP_ROOT
    if (!candidate.startsWith(path.resolve(BACKUP_ROOT) + path.sep)) continue;
    try {
      fs.accessSync(candidate, fs.constants.R_OK);
      resolvedPath = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!resolvedPath) {
    return NextResponse.json({ message: 'Arquivo não encontrado.' }, { status: 404 });
  }

  // Registrar no AuditLog
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? '';
  try {
    await prisma.auditLog.create({
      data: {
        userId:       auth.sub,
        actionType:   'DOWNLOAD',
        resourceType: 'BACKUP',
        detailsJson:  { arquivo: file },
        ipAddress:    ip,
        userAgent:    ua.slice(0, 500),
      },
    });
  } catch (err) {
    logger.error('[backup/download] Falha ao registrar AuditLog', err instanceof Error ? err : undefined);
  }

  // Servir o arquivo como stream
  const stat = fs.statSync(resolvedPath);
  const stream = fs.createReadStream(resolvedPath);
  const readable = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(readable, {
    status: 200,
    headers: {
      'Content-Type':        'application/gzip',
      'Content-Disposition': `attachment; filename="${file}"`,
      'Content-Length':      String(stat.size),
      'Cache-Control':       'no-store',
    },
  });
}, ['ADMIN']);
