import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';
import { deflateRawSync, crc32 } from 'node:zlib';

import { prisma, storageService } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Tipos
// =============================================================================

interface LoteJWTPayload extends JWTPayload {
  sub:        string;
  role:       'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
  superiorId?: string;
}

// =============================================================================
// Helper JWT
// =============================================================================

async function verificarJWT(
  request: NextRequest,
): Promise<
  | { ok: true;  payload: LoteJWTPayload }
  | { ok: false; status: 401 | 500; mensagem: string }
> {
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) token = request.cookies.get('contabilidade_jwt')?.value ?? null;
  if (!token) return { ok: false, status: 401, mensagem: 'Token de autorização ausente.' };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.fatal('[download-lote] JWT_SECRET não configurado');
    return { ok: false, status: 500, mensagem: 'Erro de configuração do servidor.' };
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ['HS256'] },
    );
    return { ok: true, payload: payload as LoteJWTPayload };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido ou expirado.' };
  }
}

// =============================================================================
// Construtor de ZIP sem dependências externas
//
// Implementa o formato ZIP (PKZIP / ISO 21320-1) usando apenas Node.js built-ins.
// Cada entrada usa compressão DEFLATE (método 8) via zlib.deflateRawSync.
//
// Estrutura:
//   [Local File Header + compressed data] × N
//   [Central Directory Header] × N
//   [End of Central Directory Record]
//
// Referência: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
// =============================================================================

interface ZipEntry {
  fileName:       string;
  compressedData: Buffer;
  uncompressedSize: number;
  crc:            number;
  offset:         number;
}

function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const entries: ZipEntry[] = [];
  const localParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data) as unknown as number;
    const compressed = deflateRawSync(file.data, { level: 6 });

    // Local File Header (30 bytes + filename)
    const lfh = Buffer.alloc(30 + nameBuffer.length);
    lfh.writeUInt32LE(0x04034b50, 0);   // signature
    lfh.writeUInt16LE(20,          4);   // version needed (2.0)
    lfh.writeUInt16LE(0x0800,      6);   // general purpose bit flag (UTF-8)
    lfh.writeUInt16LE(8,           8);   // compression method: DEFLATE
    lfh.writeUInt16LE(0,          10);   // last mod time
    lfh.writeUInt16LE(0,          12);   // last mod date
    lfh.writeUInt32LE(crc,        14);   // CRC-32
    lfh.writeUInt32LE(compressed.length,  18); // compressed size
    lfh.writeUInt32LE(file.data.length,   22); // uncompressed size
    lfh.writeUInt16LE(nameBuffer.length,  26); // filename length
    lfh.writeUInt16LE(0,                  28); // extra field length
    nameBuffer.copy(lfh, 30);

    entries.push({
      fileName:         file.name,
      compressedData:   compressed,
      uncompressedSize: file.data.length,
      crc,
      offset,
    });

    localParts.push(lfh, compressed);
    offset += lfh.length + compressed.length;
  }

  // Central Directory
  const cdParts: Buffer[] = [];
  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.fileName, 'utf8');
    const cdh = Buffer.alloc(46 + nameBuffer.length);
    cdh.writeUInt32LE(0x02014b50,               0);  // signature
    cdh.writeUInt16LE(20,                        4);  // version made by
    cdh.writeUInt16LE(20,                        6);  // version needed
    cdh.writeUInt16LE(0x0800,                    8);  // general purpose bit flag (UTF-8)
    cdh.writeUInt16LE(8,                        10);  // compression method: DEFLATE
    cdh.writeUInt16LE(0,                        12);  // last mod time
    cdh.writeUInt16LE(0,                        14);  // last mod date
    cdh.writeUInt32LE(entry.crc,               16);  // CRC-32
    cdh.writeUInt32LE(entry.compressedData.length, 20); // compressed size
    cdh.writeUInt32LE(entry.uncompressedSize,  24);  // uncompressed size
    cdh.writeUInt16LE(nameBuffer.length,       28);  // filename length
    cdh.writeUInt16LE(0,                       30);  // extra field length
    cdh.writeUInt16LE(0,                       32);  // file comment length
    cdh.writeUInt16LE(0,                       34);  // disk number start
    cdh.writeUInt16LE(0,                       36);  // internal attributes
    cdh.writeUInt32LE(0,                       38);  // external attributes
    cdh.writeUInt32LE(entry.offset,            42);  // relative offset of local header
    nameBuffer.copy(cdh, 46);
    cdParts.push(cdh);
  }

  const cdBuffer = Buffer.concat(cdParts);

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50,      0);  // signature
  eocd.writeUInt16LE(0,               4);  // disk number
  eocd.writeUInt16LE(0,               6);  // disk with central directory
  eocd.writeUInt16LE(entries.length,  8);  // number of entries on disk
  eocd.writeUInt16LE(entries.length, 10);  // total number of entries
  eocd.writeUInt32LE(cdBuffer.length, 12); // size of central directory
  eocd.writeUInt32LE(offset,          16); // offset of central directory
  eocd.writeUInt16LE(0,              20);  // comment length

  return Buffer.concat([...localParts, cdBuffer, eocd]);
}

// =============================================================================
// POST /api/v1/documentos/download-lote
//
// Cria e retorna um arquivo ZIP com os documentos solicitados.
// Máximo de 20 documentos por requisição.
//
// Body: { ids: string[] }
// Response: application/zip
// =============================================================================

export async function POST(request: NextRequest) {
  // -------------------------------------------------------------------------
  // 1. Autenticação
  // -------------------------------------------------------------------------
  const authResult = await verificarJWT(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { message: authResult.mensagem },
      { status: authResult.status },
    );
  }

  const { sub: userId, role } = authResult.payload;

  // -------------------------------------------------------------------------
  // 2. Validação do body
  // -------------------------------------------------------------------------
  let ids: string[];
  try {
    const body = await request.json();
    if (!Array.isArray(body?.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { message: 'Informe ao menos um ID de documento.' },
        { status: 400 },
      );
    }
    if (body.ids.length > 20) {
      return NextResponse.json(
        { message: 'Máximo de 20 documentos por download em lote.' },
        { status: 400 },
      );
    }
    const UUID_RE = /^[0-9a-f-]{36}$/i;
    if (!body.ids.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
      return NextResponse.json(
        { message: 'Um ou mais IDs de documento são inválidos.' },
        { status: 400 },
      );
    }
    ids = body.ids as string[];
  } catch {
    return NextResponse.json({ message: 'Body inválido.' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // 3. Busca documentos com verificação de propriedade
  // -------------------------------------------------------------------------
  type DocRow = { id: string; storagePath: string; fileName: string; clientId: string };
  let docs: DocRow[] = [];

  if (role === 'CLIENT') {
    docs = await prisma.documentoFiscal.findMany({
      where:  { id: { in: ids }, clientId: userId, deletedAt: null },
      select: { id: true, storagePath: true, fileName: true, clientId: true },
    }) as DocRow[];
  } else {
    // ACCOUNTANT/ADMIN — verifica vínculo com o cliente
    const rawDocs = await prisma.documentoFiscal.findMany({
      where:  { id: { in: ids }, deletedAt: null },
      select: { id: true, storagePath: true, fileName: true, clientId: true },
    }) as DocRow[];

    // Coleta todos os clientIds únicos dos documentos encontrados
    const clientIds = [...new Set(rawDocs.map((d) => d.clientId))];

    // Busca vínculos: este contador deve estar vinculado a TODOS os clientes
    const vinculos = await prisma.contadorCliente.findMany({
      where:  { contadorId: userId, clienteId: { in: clientIds } },
      select: { clienteId: true },
    });

    const clientesPermitidos = new Set(vinculos.map((v: { clienteId: string }) => v.clienteId));
    docs = rawDocs.filter((d) => clientesPermitidos.has(d.clientId));
  }

  if (docs.length === 0) {
    return NextResponse.json(
      { message: 'Nenhum documento encontrado ou sem permissão de acesso.' },
      { status: 404 },
    );
  }

  // -------------------------------------------------------------------------
  // 4. Busca buffers em paralelo e monta o ZIP
  // -------------------------------------------------------------------------
  const fileNameCount = new Map<string, number>();

  const fileResults = await Promise.allSettled(
    docs.map(async (doc) => {
      const data = await storageService.getBuffer(doc.storagePath);

      // Garante nomes únicos no ZIP quando houver conflito
      const prev = fileNameCount.get(doc.fileName) ?? 0;
      fileNameCount.set(doc.fileName, prev + 1);
      const name = prev === 0
        ? doc.fileName
        : (() => {
            const dotIdx = doc.fileName.lastIndexOf('.');
            return dotIdx !== -1
              ? `${doc.fileName.slice(0, dotIdx)} (${prev})${doc.fileName.slice(dotIdx)}`
              : `${doc.fileName} (${prev})`;
          })();

      return { name, data };
    }),
  );

  const arquivos: Array<{ name: string; data: Buffer }> = [];
  const falhas: string[] = [];

  for (let i = 0; i < fileResults.length; i++) {
    const result = fileResults[i];
    if (result.status === 'fulfilled') {
      arquivos.push(result.value);
    } else {
      falhas.push(docs[i].fileName);
      logger.warn('[download-lote] Falha ao buscar arquivo', {
        docId: docs[i].id,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  if (arquivos.length === 0) {
    return NextResponse.json(
      { message: 'Falha ao carregar os arquivos. Tente novamente.' },
      { status: 500 },
    );
  }

  // -------------------------------------------------------------------------
  // 5. Monta o ZIP e retorna
  // -------------------------------------------------------------------------
  try {
    const zipBuffer = buildZip(arquivos);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': 'attachment; filename="documentos.zip"',
        'Content-Length':      String(zipBuffer.length),
        'X-Arquivos-Total':    String(arquivos.length),
        ...(falhas.length > 0
          ? { 'X-Arquivos-Falha': String(falhas.length) }
          : {}),
      },
    });
  } catch (err) {
    logger.error('[download-lote] Falha ao construir ZIP', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { message: 'Falha ao gerar o arquivo ZIP. Tente novamente.' },
      { status: 500 },
    );
  }
}
