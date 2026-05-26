# Assinatura Eletrônica de Documentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Contador solicita assinatura de um documento ao cliente via email. Cliente acessa link seguro, visualiza o documento e clica "Assinar". Sistema registra: timestamp, IP, hash do documento no momento da assinatura. Gera PDF de comprovante de assinatura.

**Architecture:** Assinatura clickwrap (válida pelo Marco Civil da Internet e Lei 14.063/2020 para documentos simples). Token único por solicitação via `crypto.randomBytes`. Comprovante PDF gerado com `pdf-lib` e armazenado no MinIO. Fluxo: Contador solicita → Email enviado ao cliente → Cliente assina via link público → Registro imutável no banco.

**Tech Stack:** Prisma, Resend, `pdf-lib` (já instalado), `crypto` (built-in), MinIO

---

## Arquivo Map

| Ação | Arquivo |
|------|---------|
| Modify | `prisma/schema.prisma` |
| Create | `app/api/v1/documentos/[id]/assinatura/route.ts` (POST = solicitar) |
| Create | `app/api/v1/assinatura/[token]/route.ts` (GET = visualizar, POST = assinar) |
| Create | `app/(public)/assinar/[token]/page.tsx` (página pública de assinatura) |
| Create | `src/lib/assinatura/gerarComprovanteAssinatura.ts` |
| Create | `src/infrastructure/email/templates/solicitacaoAssinatura.ts` |

---

## Task 1: Schema — AssinaturaDocumento

- [ ] **Step 1: Adicionar model e enum**

Em `prisma/schema.prisma`:

```prisma
enum StatusAssinaturaDoc {
  PENDENTE
  ASSINADO
  RECUSADO
  EXPIRADO
}

model AssinaturaDocumento {
  id                String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  documentoId       String               @map("documento_id") @db.Uuid
  solicitanteId     String               @map("solicitante_id") @db.Uuid   // UsuarioContador
  signatarioId      String               @map("signatario_id") @db.Uuid    // UsuarioCliente
  signatarioEmail   String               @map("signatario_email") @db.VarChar(255)
  signatarioNome    String               @map("signatario_nome") @db.VarChar(255)
  status            StatusAssinaturaDoc  @default(PENDENTE)
  tokenAssinatura   String               @unique @map("token_assinatura") @db.VarChar(128)
  expiresAt         DateTime             @map("expires_at") @db.Timestamptz
  assinadoAt        DateTime?            @map("assinado_at") @db.Timestamptz
  ipAssinatura      String?              @map("ip_assinatura") @db.VarChar(45)
  hashDocumento     String               @map("hash_documento") @db.Char(64)
  comprovanteStoragePath String?         @map("comprovante_storage_path") @db.VarChar(1000)
  motivoRecusa      String?              @map("motivo_recusa") @db.VarChar(500)
  createdAt         DateTime             @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime             @updatedAt @map("updated_at") @db.Timestamptz

  @@index([documentoId])
  @@index([signatarioId])
  @@index([tokenAssinatura])
  @@index([status, expiresAt])
  @@map("assinatura_documento")
}
```

Adicionar em `ActionType` enum: `ASSINATURA_SOLICITADA`, `ASSINATURA_CONCLUIDA`, `ASSINATURA_RECUSADA`

- [ ] **Step 2: Migrar**

```bash
npx prisma migrate dev --name add_assinatura_documento
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(assinatura): add AssinaturaDocumento table"
```

---

## Task 2: Email de solicitação

**Files:**
- Create: `src/infrastructure/email/templates/solicitacaoAssinatura.ts`

- [ ] **Step 1: Criar template**

```typescript
export interface SolicitacaoAssinaturaData {
  nomeCliente:   string;
  nomeContador:  string;
  nomeDocumento: string;
  linkAssinatura: string;
  expiracaoHoras: number;
}

export function solicitacaoAssinaturaHtml(d: SolicitacaoAssinaturaData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
    <div style="background:#2563eb;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">✍️ Assinatura de Documento</h1>
    </div>
    <div style="padding:24px">
      <p>Olá, <strong>${d.nomeCliente}</strong>!</p>
      <p>O escritório <strong>${d.nomeContador}</strong> solicita sua assinatura no documento:</p>
      <div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:16px 0;text-align:center">
        <p style="margin:0;font-weight:bold;font-size:16px">📄 ${d.nomeDocumento}</p>
      </div>
      <p style="color:#6b7280;font-size:14px">Este link expira em <strong>${d.expiracaoHoras} horas</strong>.</p>
      <div style="text-align:center;margin-top:24px">
        <a href="${d.linkAssinatura}" style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Visualizar e Assinar</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Se você não reconhece esta solicitação, ignore este email.</p>
    </div>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/email/templates/solicitacaoAssinatura.ts
git commit -m "feat(assinatura): add solicitation email template"
```

---

## Task 3: Rota de solicitação de assinatura

**Files:**
- Create: `app/api/v1/documentos/[id]/assinatura/route.ts`

- [ ] **Step 1: Criar rota POST**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { solicitacaoAssinaturaHtml } from '@/src/infrastructure/email/templates/solicitacaoAssinatura';

const resend = new Resend(process.env.RESEND_API_KEY);
const EXPIRACAO_HORAS = 72;

export const POST = withAuth(async (req, { params }) => {
  const { id: documentoId } = await params;
  const { signatarioId } = await req.json();

  const [documento, cliente] = await Promise.all([
    prisma.documentoFiscal.findUnique({ where: { id: documentoId, deletedAt: null }, select: { fileName: true, fileHash: true, clientId: true } }),
    prisma.usuarioCliente.findUnique({ where: { id: signatarioId }, select: { name: true, email: true } }),
  ]);

  if (!documento) return NextResponse.json({ message: 'Documento não encontrado' }, { status: 404 });
  if (!cliente)   return NextResponse.json({ message: 'Cliente não encontrado' }, { status: 404 });

  const token     = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRACAO_HORAS * 60 * 60 * 1000);
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const assinatura = await prisma.assinaturaDocumento.create({
    data: {
      documentoId,
      solicitanteId:  req.headers.get('x-user-id') ?? '',
      signatarioId,
      signatarioEmail: cliente.email,
      signatarioNome:  cliente.name,
      tokenAssinatura: token,
      hashDocumento:   documento.fileHash,
      expiresAt,
    },
  });

  const linkAssinatura = `${appUrl}/assinar/${token}`;

  await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@konto.app',
    to:      cliente.email,
    subject: `Assinatura solicitada: ${documento.fileName}`,
    html:    solicitacaoAssinaturaHtml({
      nomeCliente:    cliente.name,
      nomeContador:   'Seu escritório contábil',
      nomeDocumento:  documento.fileName,
      linkAssinatura,
      expiracaoHoras: EXPIRACAO_HORAS,
    }),
  });

  return NextResponse.json({ assinaturaId: assinatura.id, expiresAt });
}, ['ACCOUNTANT', 'EMPLOYEE']);
```

- [ ] **Step 2: Rota GET — listar assinaturas de um documento**

```typescript
export const GET = withAuth(async (req, { params }) => {
  const { id: documentoId } = await params;

  const assinaturas = await prisma.assinaturaDocumento.findMany({
    where: { documentoId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ assinaturas });
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
```

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/documentos/\[id\]/assinatura/
git commit -m "feat(assinatura): add POST/GET /documentos/:id/assinatura routes"
```

---

## Task 4: Rota pública de assinatura

**Files:**
- Create: `app/api/v1/assinatura/[token]/route.ts`

- [ ] **Step 1: Criar GET (visualizar documento antes de assinar)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/infrastructure/database/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where: { tokenAssinatura: token },
    include: { documento: { select: { fileName: true, fileType: true } } } as never,
  });

  if (!assinatura) return NextResponse.json({ message: 'Link inválido' }, { status: 404 });
  if (assinatura.status !== 'PENDENTE') return NextResponse.json({ message: 'Este link já foi utilizado', status: assinatura.status }, { status: 410 });
  if (new Date() > assinatura.expiresAt) {
    await prisma.assinaturaDocumento.update({ where: { id: assinatura.id }, data: { status: 'EXPIRADO' } });
    return NextResponse.json({ message: 'Link expirado' }, { status: 410 });
  }

  return NextResponse.json({
    nomeDocumento:  (assinatura as any).documento?.fileName,
    signatarioNome: assinatura.signatarioNome,
    expiresAt:      assinatura.expiresAt,
  });
}
```

- [ ] **Step 2: Criar POST (confirmar assinatura)**

```typescript
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { confirmacao } = await req.json(); // true = assinou, false = recusou
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown';

  const assinatura = await prisma.assinaturaDocumento.findUnique({ where: { tokenAssinatura: token } });

  if (!assinatura || assinatura.status !== 'PENDENTE' || new Date() > assinatura.expiresAt) {
    return NextResponse.json({ message: 'Link inválido ou expirado' }, { status: 410 });
  }

  if (!confirmacao) {
    const { motivoRecusa } = await req.json().catch(() => ({}));
    await prisma.assinaturaDocumento.update({
      where: { id: assinatura.id },
      data: { status: 'RECUSADO', motivoRecusa: motivoRecusa ?? 'Recusado pelo signatário' },
    });
    return NextResponse.json({ message: 'Assinatura recusada' });
  }

  await prisma.assinaturaDocumento.update({
    where: { id: assinatura.id },
    data: { status: 'ASSINADO', assinadoAt: new Date(), ipAssinatura: ip },
  });

  return NextResponse.json({ message: 'Documento assinado com sucesso' });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/assinatura/
git commit -m "feat(assinatura): add public GET/POST /assinatura/:token routes"
```

---

## Task 5: Página pública de assinatura

**Files:**
- Create: `app/(public)/assinar/[token]/page.tsx`

- [ ] **Step 1: Verificar se existe route group (public)**

Verifique se existe `app/(public)/` ou crie o diretório. Páginas públicas não passam pelo middleware de autenticação — verificar `proxy.ts` matcher para confirmar que `/assinar/*` não está na lista de rotas protegidas.

- [ ] **Step 2: Criar página**

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AssinarPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo]       = useState<{ nomeDocumento: string; signatarioNome: string; expiresAt: string } | null>(null);
  const [erro, setErro]       = useState<string | null>(null);
  const [estado, setEstado]   = useState<'idle' | 'loading' | 'assinado' | 'recusado'>('idle');

  useEffect(() => {
    fetch(`/api/v1/assinatura/${token}`)
      .then((r) => r.json())
      .then((d) => { if (d.message && !d.nomeDocumento) setErro(d.message); else setInfo(d); })
      .catch(() => setErro('Erro ao carregar informações'));
  }, [token]);

  async function assinar() {
    setEstado('loading');
    const r = await fetch(`/api/v1/assinatura/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmacao: true }),
    });
    setEstado(r.ok ? 'assinado' : 'idle');
  }

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><p className="text-red-500 text-lg">{erro}</p></div>
    </div>
  );

  if (estado === 'assinado') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-green-700">Documento assinado com sucesso!</h1>
        <p className="text-muted-foreground">Seu escritório contábil foi notificado.</p>
      </div>
    </div>
  );

  if (!info) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-4">📄</div>
          <h1 className="text-xl font-bold">Assinatura de Documento</h1>
          <p className="text-muted-foreground mt-1">Olá, <strong>{info.signatarioNome}</strong></p>
        </div>
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="font-medium">{info.nomeDocumento}</p>
          <p className="text-sm text-muted-foreground mt-1">Expira em: {new Date(info.expiresAt).toLocaleString('pt-BR')}</p>
        </div>
        <p className="text-sm text-center text-muted-foreground">
          Ao clicar em "Assinar", você confirma que leu e concorda com o conteúdo do documento acima. Esta ação é registrada com data, hora e IP.
        </p>
        <div className="space-y-3">
          <button onClick={assinar} disabled={estado === 'loading'} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
            {estado === 'loading' ? 'Processando...' : '✍️ Assinar Documento'}
          </button>
          <button onClick={() => setEstado('recusado')} className="w-full border py-3 rounded-lg text-muted-foreground hover:bg-muted">
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar /assinar/* ao matcher do proxy.ts como rota PÚBLICA (não proteger)**

Verificar `proxy.ts` — se `/assinar` não estiver na lista de rotas protegidas, não precisa alterar nada. Se estiver, remover.

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat(assinatura): add public signing page at /assinar/:token"
```

---

## Verificação final

- [ ] Solicitar assinatura de documento → email enviado ao cliente
- [ ] Abrir link → página carrega nome do documento
- [ ] Clicar "Assinar" → status muda para ASSINADO no banco
- [ ] Usar link novamente → retorna 410 (já utilizado)
- [ ] Link expirado → retorna 410
- [ ] `npm run build` sem erros
