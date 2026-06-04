import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { createHash } from 'crypto';

import { prisma, storageService } from '../../../../../../../src/infrastructure/di/Container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS_ACEITOS: Record<string, 'PDF' | 'XML'> = {
  'application/pdf': 'PDF',
  'application/xml': 'XML',
  'text/xml':        'XML',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// =============================================================================
// POST /api/v1/chat/rooms/[roomId]/attachment
//
// Upload de arquivo em um chat. Cria DocumentoFiscal e retorna o documentId
// para ser enviado junto com a mensagem de chat.
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const auth = await verificarJWT(request);
  if (!auth.ok) return NextResponse.json({ message: auth.mensagem }, { status: auth.status });

  const { roomId } = await params;
  const { sub, role, contadorId } = auth.payload;

  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
  if (!room) return NextResponse.json({ message: 'Sala não encontrada.' }, { status: 404 });

  const temAcesso = await verificarAcessoSala(sub, role, room.clienteId, contadorId);
  if (!temAcesso) return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });

  const formData = await request.formData();
  const arquivo  = formData.get('arquivo') as File | null;

  if (!arquivo || !(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ message: 'Arquivo obrigatório.' }, { status: 400 });
  }

  const fileType = TIPOS_ACEITOS[arquivo.type];
  if (!fileType) {
    return NextResponse.json({ message: 'Tipo não permitido. Envie PDF ou XML.' }, { status: 400 });
  }

  if (arquivo.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: 'Arquivo excede 10 MB.' }, { status: 400 });
  }

  const buffer     = Buffer.from(await arquivo.arrayBuffer());
  const fileHash   = createHash('sha256').update(buffer).digest('hex');
  const timestamp  = Date.now();
  const safeName   = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `chat/${roomId}/${timestamp}_${safeName}`;

  await storageService.upload(storagePath, buffer, arquivo.type);

  const clienteId = room.clienteId;

  const documento = await prisma.documentoFiscal.create({
    data: {
      clientId:      clienteId,
      uploadedById:  sub,
      fileName:      arquivo.name,
      storagePath,
      fileType,
      fileSizeBytes: BigInt(arquivo.size),
      fileHash,
    },
    select: { id: true, fileName: true },
  });

  return NextResponse.json({ documentId: documento.id, fileName: documento.fileName }, { status: 201 });
}

// =============================================================================
// Helpers (espelhados do route.ts da sala)
// =============================================================================

async function verificarAcessoSala(
  userId: string,
  role: string,
  clienteIdDaSala: string,
  contadorId?: string,
): Promise<boolean> {
  if (role === 'CLIENT') return userId === clienteIdDaSala;
  const vinculo = await prisma.contadorCliente.findFirst({
    where: { contadorId: contadorId ?? userId, clienteId: clienteIdDaSala },
  });
  return !!vinculo;
}

interface JWTInfo {
  sub:         string;
  role:        'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
  nome:        string;
  contadorId?: string;
}

async function verificarJWT(
  request: NextRequest,
): Promise<{ ok: true; payload: JWTInfo } | { ok: false; status: number; mensagem: string }> {
  const authHeader = request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) token = request.cookies.get('contabilidade_jwt')?.value ?? null;
  if (!token) return { ok: false, status: 401, mensagem: 'Token ausente.' };

  const secret = process.env.JWT_SECRET;
  if (!secret) return { ok: false, status: 500, mensagem: 'Erro de configuração.' };

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });

    let role = payload.role as string;
    let sub  = payload.sub as string;
    const vinculo    = payload.vinculo    as string | undefined;
    const superiorId = payload.superiorId as string | undefined;
    let contadorId: string | undefined;

    if (role === 'EMPLOYEE' && vinculo === 'CLIENTE' && superiorId) {
      role = 'CLIENT';
      sub  = superiorId;
    }
    if (role === 'EMPLOYEE' && vinculo === 'ESCRITORIO' && superiorId) {
      role       = 'ACCOUNTANT';
      contadorId = superiorId;
    }

    if (!['CLIENT', 'ACCOUNTANT', 'ADMIN'].includes(role)) {
      return { ok: false, status: 403, mensagem: 'Acesso não permitido.' };
    }

    return {
      ok: true,
      payload: {
        sub,
        role:       role as JWTInfo['role'],
        nome:       (payload.nome as string) ?? 'Usuário',
        contadorId,
      },
    };
  } catch {
    return { ok: false, status: 401, mensagem: 'Token inválido ou expirado.' };
  }
}
