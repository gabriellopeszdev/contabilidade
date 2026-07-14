# Comunicados / Informativos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contador publica comunicados para clientes com targeting flexível; clientes visualizam na página "Informativos" com notificação em tempo real via sino.

**Architecture:** Duas novas tabelas Prisma (`Comunicado` + `ComunicadoDestinatario`), 6 endpoints REST, evento de domínio `NovoComunicadoEvent` roteado pelo SocketServer existente, componentes Tiptap, e páginas em `/(contador)/comunicados` e `/(cliente)/informativos`.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Socket.IO + Redis (RedisEventDispatcher), MinIO (anexos), Tiptap (editor), isomorphic-dompurify (sanitização), Tailwind CSS, SWR, Lucide React.

---

## File Map

### Novos arquivos
- `prisma/migrations/20260713000000_add_comunicados/migration.sql`
- `src/domain/events/NovoComunicadoEvent.ts`
- `app/api/v1/comunicados/route.ts`
- `app/api/v1/comunicados/[id]/route.ts`
- `app/api/v1/comunicados/[id]/confirmar/route.ts`
- `app/api/v1/comunicados/[id]/destinatarios/route.ts`
- `src/presentation/hooks/useComunicados.ts`
- `src/presentation/components/comunicados/NovoComunicadoModal.tsx`
- `src/presentation/components/comunicados/ComunicadoCard.tsx`
- `src/presentation/components/comunicados/DestinatariosTable.tsx`
- `app/(contador)/comunicados/page.tsx`
- `app/(contador)/comunicados/[id]/page.tsx`
- `app/(cliente)/informativos/page.tsx`
- `app/(cliente)/informativos/[id]/page.tsx`

### Arquivos modificados
- `prisma/schema.prisma` — modelos `Comunicado` e `ComunicadoDestinatario` + relações em `UsuarioContador` e `UsuarioCliente`
- `src/infrastructure/websockets/SocketServer.ts` — adicionar `novo_comunicado` a `ServerToClientEvents` + case em `roteaEvento()`
- `src/presentation/hooks/useNotificacoes.ts` — exportar `getSocket()`
- `app/(contador)/layout.tsx` — adicionar link "Comunicados" em NAV_GROUPS
- `app/(cliente)/layout.tsx` — adicionar link "Informativos" em NAV_GROUPS

---

## Task 1: Instalar dependências + Schema Prisma + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260713000000_add_comunicados/migration.sql`

- [ ] **Step 1: Instalar pacotes**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link isomorphic-dompurify
```

- [ ] **Step 2: Adicionar relações nos modelos existentes**

Em `prisma/schema.prisma`, adicionar ao final do modelo `UsuarioContador` (dentro das relações, antes do `@@index`):

```prisma
  comunicados Comunicado[]
```

Adicionar ao final do modelo `UsuarioCliente` (dentro das relações, antes do `@@index`):

```prisma
  comunicadosDestinatario ComunicadoDestinatario[]
```

- [ ] **Step 3: Adicionar os dois novos modelos ao final do schema**

Adicionar ao final de `prisma/schema.prisma`:

```prisma
// =============================================================================
// Comunicado — Aviso publicado pelo contador para seus clientes
// =============================================================================

model Comunicado {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  contadorId       String    @map("contador_id") @db.Uuid
  titulo           String    @db.VarChar(255)
  conteudo         String    // HTML gerado pelo Tiptap
  anexoPath        String?   @map("anexo_path")
  anexoNome        String?   @map("anexo_nome")
  exigeConfirmacao Boolean   @default(false) @map("exige_confirmacao")
  targeting        String    @db.VarChar(20)           // TODOS | SETOR | SELECIONADOS
  setor            String?   @db.VarChar(20)           // preenchido quando targeting = SETOR
  publicadoAt      DateTime  @default(now()) @map("publicado_at") @db.Timestamptz
  deletedAt        DateTime? @map("deleted_at") @db.Timestamptz

  contador      UsuarioContador          @relation(fields: [contadorId], references: [id])
  destinatarios ComunicadoDestinatario[]

  @@index([contadorId])
  @@index([publicadoAt(sort: Desc)])
  @@map("comunicados")
}

model ComunicadoDestinatario {
  comunicadoId String    @map("comunicado_id") @db.Uuid
  clienteId    String    @map("cliente_id") @db.Uuid
  lido         Boolean   @default(false)
  lidoAt       DateTime? @map("lido_at") @db.Timestamptz
  confirmado   Boolean   @default(false)
  confirmadoAt DateTime? @map("confirmado_at") @db.Timestamptz

  comunicado Comunicado     @relation(fields: [comunicadoId], references: [id])
  cliente    UsuarioCliente @relation(fields: [clienteId], references: [id])

  @@id([comunicadoId, clienteId])
  @@index([clienteId])
  @@map("comunicado_destinatarios")
}
```

- [ ] **Step 4: Gerar migration**

```bash
npx prisma migrate dev --name add_comunicados
```

Expected output: `The following migration(s) have been created and applied: migrations/20260713000000_add_comunicados/migration.sql`

- [ ] **Step 5: Verificar geração do cliente Prisma**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client ... to ./node_modules/@prisma/client`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ package.json package-lock.json
git commit -m "feat(comunicados): instalar deps Tiptap e adicionar modelos Prisma"
```

---

## Task 2: Evento de domínio NovoComunicadoEvent + Socket.IO

**Files:**
- Create: `src/domain/events/NovoComunicadoEvent.ts`
- Modify: `src/infrastructure/websockets/SocketServer.ts`
- Modify: `src/presentation/hooks/useNotificacoes.ts`

- [ ] **Step 1: Criar NovoComunicadoEvent**

Criar `src/domain/events/NovoComunicadoEvent.ts`:

```typescript
import { randomUUID } from 'crypto';
import type { DomainEvent } from '../../shared/DomainEvent';

export class NovoComunicadoEvent implements DomainEvent {
  readonly eventId   = randomUUID();
  readonly eventName = 'NovoComunicadoEvent' as const;
  readonly occurredAt = new Date();

  constructor(
    readonly comunicadoId: string,
    readonly titulo:       string,
    readonly contadorNome: string,
    readonly clienteIds:   string[],
  ) {}
}
```

- [ ] **Step 2: Adicionar `novo_comunicado` à interface ServerToClientEvents**

Em `src/infrastructure/websockets/SocketServer.ts`, dentro de `interface ServerToClientEvents`, adicionar após o evento `cliente_ativado`:

```typescript
  /** Disparado ao cliente quando um novo comunicado é publicado. */
  novo_comunicado: (payload: {
    comunicadoId: string;
    titulo:       string;
    contadorNome: string;
  }) => void;
```

- [ ] **Step 3: Adicionar case NovoComunicadoEvent em roteaEvento()**

Em `src/infrastructure/websockets/SocketServer.ts`, dentro do método `roteaEvento()`, adicionar antes do `default:`:

```typescript
      case 'NovoComunicadoEvent': {
        const comunicadoId = event.comunicadoId as string | undefined;
        const titulo       = event.titulo       as string | undefined;
        const contadorNome = event.contadorNome as string | undefined;
        const clienteIds   = (event.clienteIds  as string[] | undefined) ?? [];

        if (!comunicadoId || !titulo) break;

        for (const clienteId of clienteIds) {
          this.io.to(`user:${clienteId}`).emit('novo_comunicado', {
            comunicadoId,
            titulo,
            contadorNome: contadorNome ?? '',
          });

          void this.persistirEEmitir(clienteId, 'CLIENTE', {
            tipo:     'COMUNICADO',
            titulo:   `Novo informativo: ${titulo}`,
            mensagem: `Seu contador publicou um novo comunicado.`,
            metadados: { comunicadoId },
          });
        }
        break;
      }
```

- [ ] **Step 4: Exportar getSocket() de useNotificacoes.ts**

Em `src/presentation/hooks/useNotificacoes.ts`, adicionar após a declaração `let socketToken`:

```typescript
/** Retorna a instância singleton do socket (null se não conectado). */
export function getSocket(): typeof socket { return socket; }
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/events/NovoComunicadoEvent.ts \
        src/infrastructure/websockets/SocketServer.ts \
        src/presentation/hooks/useNotificacoes.ts
git commit -m "feat(comunicados): adicionar NovoComunicadoEvent e evento WS novo_comunicado"
```

---

## Task 3: API — POST + GET /api/v1/comunicados

**Files:**
- Create: `app/api/v1/comunicados/route.ts`

- [ ] **Step 1: Criar o arquivo de rota**

Criar `app/api/v1/comunicados/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { withAuth }     from '../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService, eventDispatcher } from '../../../../src/infrastructure/di/Container';
import { NovoComunicadoEvent } from '../../../../src/domain/events/NovoComunicadoEvent';
import { logger } from '../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// POST /api/v1/comunicados
// Publica um comunicado. Role: ACCOUNTANT
// Body: multipart/form-data
//   titulo, conteudo, exigeConfirmacao, targeting, setor?, clienteIds[]?, anexo?
// =============================================================================

export const POST = withAuth(async (req, _ctx, auth) => {
  try {
    const form             = await req.formData();
    const titulo           = (form.get('titulo')           as string | null)?.trim();
    const conteudo         = (form.get('conteudo')         as string | null)?.trim();
    const exigeConfirmacao = form.get('exigeConfirmacao')  === 'true';
    const targeting        = form.get('targeting')         as string | null;
    const setor            = form.get('setor')             as string | null;
    const clienteIdsRaw    = form.getAll('clienteIds')     as string[];
    const anexo            = form.get('anexo')             as File | null;

    if (!titulo || titulo.length < 2) {
      return NextResponse.json({ message: 'Título obrigatório (mínimo 2 caracteres).' }, { status: 400 });
    }
    if (!conteudo || conteudo.length < 5) {
      return NextResponse.json({ message: 'Conteúdo obrigatório.' }, { status: 400 });
    }
    if (!['TODOS', 'SETOR', 'SELECIONADOS'].includes(targeting ?? '')) {
      return NextResponse.json({ message: 'Targeting inválido.' }, { status: 400 });
    }
    if (targeting === 'SETOR' && !['FISCAL', 'PESSOAL', 'CONTABIL'].includes(setor ?? '')) {
      return NextResponse.json({ message: 'Setor inválido para targeting SETOR.' }, { status: 400 });
    }
    if (targeting === 'SELECIONADOS' && clienteIdsRaw.length === 0) {
      return NextResponse.json({ message: 'Selecione ao menos um cliente.' }, { status: 400 });
    }

    // ------------------------------------------------------------------
    // Resolver destinatários
    // ------------------------------------------------------------------
    let clienteIds: string[] = [];

    if (targeting === 'TODOS') {
      const vinculos = await prisma.contadorCliente.findMany({
        where:  { contadorId: auth.sub },
        select: { clienteId: true },
      });
      clienteIds = vinculos.map((v) => v.clienteId);
    } else if (targeting === 'SETOR') {
      const docs = await prisma.documentoFiscal.findMany({
        where: {
          sector:    setor as 'FISCAL' | 'PESSOAL' | 'CONTABIL',
          deletedAt: null,
          client: {
            contadoresRel: { some: { contadorId: auth.sub } },
            deletedAt: null,
          },
        },
        distinct: ['clientId'],
        select:   { clientId: true },
      });
      clienteIds = docs.map((d) => d.clientId);
    } else {
      // SELECIONADOS — validar que todos pertencem à carteira do contador
      const vinculos = await prisma.contadorCliente.findMany({
        where: {
          contadorId: auth.sub,
          clienteId:  { in: clienteIdsRaw },
        },
        select: { clienteId: true },
      });
      clienteIds = vinculos.map((v) => v.clienteId);
      if (clienteIds.length !== clienteIdsRaw.length) {
        return NextResponse.json(
          { message: 'Um ou mais clientes selecionados não pertencem à sua carteira.' },
          { status: 400 },
        );
      }
    }

    // ------------------------------------------------------------------
    // Upload de anexo (opcional)
    // ------------------------------------------------------------------
    let anexoPath: string | null = null;
    let anexoNome: string | null = null;

    if (anexo && anexo.size > 0) {
      if (anexo.size > 50 * 1024 * 1024) {
        return NextResponse.json({ message: 'Anexo excede 50 MB.' }, { status: 400 });
      }
      const buffer    = Buffer.from(await anexo.arrayBuffer());
      const safeName  = anexo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uuid      = crypto.randomUUID();
      anexoPath       = `comunicados/${auth.sub}/${uuid}/${safeName}`;
      anexoNome       = anexo.name;
      await storageService.upload(anexoPath, buffer, anexo.type || 'application/octet-stream');
    }

    // ------------------------------------------------------------------
    // Buscar nome do contador
    // ------------------------------------------------------------------
    const contador = await prisma.usuarioContador.findUnique({
      where:  { id: auth.sub },
      select: { name: true },
    });

    // ------------------------------------------------------------------
    // Criar Comunicado + ComunicadoDestinatario em transação
    // ------------------------------------------------------------------
    const comunicado = await prisma.$transaction(async (tx) => {
      const c = await tx.comunicado.create({
        data: {
          contadorId:       auth.sub,
          titulo,
          conteudo,
          exigeConfirmacao,
          targeting:        targeting!,
          setor:            targeting === 'SETOR' ? setor : null,
          ...(anexoPath ? { anexoPath, anexoNome } : {}),
        },
      });

      if (clienteIds.length > 0) {
        await tx.comunicadoDestinatario.createMany({
          data: clienteIds.map((clienteId) => ({
            comunicadoId: c.id,
            clienteId,
          })),
          skipDuplicates: true,
        });
      }

      return c;
    });

    // ------------------------------------------------------------------
    // Disparar evento de domínio (fire-and-forget)
    // ------------------------------------------------------------------
    if (clienteIds.length > 0) {
      void eventDispatcher.dispatch(
        new NovoComunicadoEvent(
          comunicado.id,
          titulo,
          contador?.name ?? 'Seu contador',
          clienteIds,
        ),
      );
    }

    return NextResponse.json(
      { id: comunicado.id, titulo: comunicado.titulo, totalDestinatarios: clienteIds.length },
      { status: 201 },
    );
  } catch (err) {
    logger.error('[POST /comunicados] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);

// =============================================================================
// GET /api/v1/comunicados
// Roles: ACCOUNTANT (seus comunicados) | CLIENT (comunicados do seu contador)
// Query: page=1, perPage=20
// =============================================================================

export const GET = withAuth(async (req, _ctx, auth) => {
  try {
    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, parseInt(searchParams.get('page')    ?? '1',  10));
    const perPage = Math.min(50, parseInt(searchParams.get('perPage') ?? '20', 10));
    const skip    = (page - 1) * perPage;

    if (auth.role === 'ACCOUNTANT') {
      const [total, items] = await Promise.all([
        prisma.comunicado.count({ where: { contadorId: auth.sub, deletedAt: null } }),
        prisma.comunicado.findMany({
          where:   { contadorId: auth.sub, deletedAt: null },
          orderBy: { publicadoAt: 'desc' },
          skip,
          take:    perPage,
          include: {
            _count: {
              select: { destinatarios: true },
            },
            destinatarios: {
              select: { lido: true, confirmado: true },
            },
          },
        }),
      ]);

      return NextResponse.json({
        total,
        page,
        perPage,
        items: items.map((c) => ({
          id:               c.id,
          titulo:           c.titulo,
          targeting:        c.targeting,
          setor:            c.setor,
          exigeConfirmacao: c.exigeConfirmacao,
          publicadoAt:      c.publicadoAt.toISOString(),
          totalDestinatarios: c._count.destinatarios,
          totalLidos:         c.destinatarios.filter((d) => d.lido).length,
          totalConfirmados:   c.destinatarios.filter((d) => d.confirmado).length,
        })),
      });
    }

    // CLIENT — comunicados do contador publicados após o vínculo
    const vinculo = await prisma.contadorCliente.findFirst({
      where:  { clienteId: auth.sub },
      select: { contadorId: true, assignedAt: true },
    });

    if (!vinculo) {
      return NextResponse.json({ total: 0, page, perPage, items: [] });
    }

    const baseWhere = {
      contadorId: vinculo.contadorId,
      publicadoAt: { gte: vinculo.assignedAt },
      deletedAt:   null,
    };

    const [total, items] = await Promise.all([
      prisma.comunicado.count({ where: baseWhere }),
      prisma.comunicado.findMany({
        where:   baseWhere,
        orderBy: { publicadoAt: 'desc' },
        skip,
        take:    perPage,
        include: {
          destinatarios: {
            where:  { clienteId: auth.sub },
            select: { lido: true, confirmado: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      perPage,
      items: items.map((c) => {
        const dest = c.destinatarios[0] ?? null;
        return {
          id:               c.id,
          titulo:           c.titulo,
          conteudo:         c.conteudo.replace(/<[^>]+>/g, '').slice(0, 120),
          exigeConfirmacao: c.exigeConfirmacao,
          publicadoAt:      c.publicadoAt.toISOString(),
          souDestinatario:  dest !== null,
          lido:             dest?.lido ?? false,
          confirmado:       dest?.confirmado ?? false,
        };
      }),
    });
  } catch (err) {
    logger.error('[GET /comunicados] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'CLIENT']);
```

- [ ] **Step 2: Commit**

```bash
git add app/api/v1/comunicados/route.ts src/domain/events/NovoComunicadoEvent.ts
git commit -m "feat(comunicados): POST e GET /api/v1/comunicados"
```

---

## Task 4: API — GET + DELETE /api/v1/comunicados/[id]

**Files:**
- Create: `app/api/v1/comunicados/[id]/route.ts`

- [ ] **Step 1: Criar arquivo**

Criar `app/api/v1/comunicados/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { withAuth }     from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, storageService } from '../../../../../src/infrastructure/di/Container';
import { logger } from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// =============================================================================
// GET /api/v1/comunicados/[id]
// Contador: ver seu próprio comunicado
// Cliente: ver comunicado do seu contador + marca como lido automaticamente
// =============================================================================

export const GET = withAuth(async (req, ctx, auth) => {
  try {
    const { id } = await (ctx as Ctx).params;

    const comunicado = await prisma.comunicado.findFirst({
      where:   { id, deletedAt: null },
      include: { contador: { select: { id: true, name: true } } },
    });

    if (!comunicado) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }

    if (auth.role === 'ACCOUNTANT') {
      if (comunicado.contadorId !== auth.sub) {
        return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
      }

      let anexoUrl: string | null = null;
      if (comunicado.anexoPath) {
        try {
          anexoUrl = await storageService.getPresignedUrl(comunicado.anexoPath, 3600);
        } catch { /* ignora */ }
      }

      return NextResponse.json({
        id:               comunicado.id,
        titulo:           comunicado.titulo,
        conteudo:         comunicado.conteudo,
        exigeConfirmacao: comunicado.exigeConfirmacao,
        targeting:        comunicado.targeting,
        setor:            comunicado.setor,
        publicadoAt:      comunicado.publicadoAt.toISOString(),
        anexoNome:        comunicado.anexoNome,
        anexoUrl,
      });
    }

    // CLIENT
    const vinculo = await prisma.contadorCliente.findFirst({
      where:  { clienteId: auth.sub, contadorId: comunicado.contadorId },
      select: { assignedAt: true },
    });

    if (!vinculo || comunicado.publicadoAt < vinculo.assignedAt) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }

    // Marca como lido (upsert: cria destinatário se não existir ainda)
    const dest = await prisma.comunicadoDestinatario.upsert({
      where:  { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
      create: { comunicadoId: id, clienteId: auth.sub, lido: true, lidoAt: new Date() },
      update: (await prisma.comunicadoDestinatario.findUnique({
        where: { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
      }))?.lido
        ? {}
        : { lido: true, lidoAt: new Date() },
    });

    let anexoUrl: string | null = null;
    if (comunicado.anexoPath) {
      try {
        anexoUrl = await storageService.getPresignedUrl(comunicado.anexoPath, 3600);
      } catch { /* ignora */ }
    }

    return NextResponse.json({
      id:               comunicado.id,
      titulo:           comunicado.titulo,
      conteudo:         comunicado.conteudo,
      exigeConfirmacao: comunicado.exigeConfirmacao,
      publicadoAt:      comunicado.publicadoAt.toISOString(),
      anexoNome:        comunicado.anexoNome,
      anexoUrl,
      souDestinatario:  true,
      lido:             dest.lido,
      confirmado:       dest.confirmado,
    });
  } catch (err) {
    logger.error('[GET /comunicados/[id]] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'CLIENT']);

// =============================================================================
// DELETE /api/v1/comunicados/[id]
// Soft delete. Role: ACCOUNTANT
// =============================================================================

export const DELETE = withAuth(async (_req, ctx, auth) => {
  try {
    const { id } = await (ctx as Ctx).params;

    const comunicado = await prisma.comunicado.findFirst({
      where: { id, deletedAt: null },
    });

    if (!comunicado || comunicado.contadorId !== auth.sub) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }

    await prisma.comunicado.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[DELETE /comunicados/[id]] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
```

**Nota:** O `upsert` no GET do cliente usa um padrão seguro — o `update` vazio `{}` preserva o estado quando já lido. Para simplificar, usar `updateMany` com condição:

Substituir o bloco `upsert` por:

```typescript
    // Marca como lido se ainda não leu
    await prisma.comunicadoDestinatario.upsert({
      where:  { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
      create: { comunicadoId: id, clienteId: auth.sub, lido: true, lidoAt: new Date() },
      update: { lido: true, lidoAt: new Date() },
    });

    const dest = await prisma.comunicadoDestinatario.findUnique({
      where: { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
    });
```

- [ ] **Step 2: Commit**

```bash
git add app/api/v1/comunicados/[id]/route.ts
git commit -m "feat(comunicados): GET e DELETE /api/v1/comunicados/[id]"
```

---

## Task 5: API — PATCH /confirmar + GET /destinatarios

**Files:**
- Create: `app/api/v1/comunicados/[id]/confirmar/route.ts`
- Create: `app/api/v1/comunicados/[id]/destinatarios/route.ts`

- [ ] **Step 1: Criar rota de confirmação**

Criar `app/api/v1/comunicados/[id]/confirmar/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { withAuth }     from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }       from '../../../../../../src/infrastructure/di/Container';
import { logger }       from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth(async (_req, ctx, auth) => {
  try {
    const { id } = await (ctx as Ctx).params;

    const dest = await prisma.comunicadoDestinatario.findUnique({
      where:   { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
      include: { comunicado: { select: { exigeConfirmacao: true, deletedAt: true } } },
    });

    if (!dest || dest.comunicado.deletedAt) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }
    if (!dest.comunicado.exigeConfirmacao) {
      return NextResponse.json({ message: 'Este comunicado não exige confirmação.' }, { status: 400 });
    }
    if (dest.confirmado) {
      return NextResponse.json({ ok: true }); // idempotente
    }

    await prisma.comunicadoDestinatario.update({
      where: { comunicadoId_clienteId: { comunicadoId: id, clienteId: auth.sub } },
      data:  { confirmado: true, confirmadoAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[PATCH /comunicados/[id]/confirmar] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['CLIENT']);
```

- [ ] **Step 2: Criar rota de destinatários**

Criar `app/api/v1/comunicados/[id]/destinatarios/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { withAuth }     from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }       from '../../../../../../src/infrastructure/di/Container';
import { logger }       from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req, ctx, auth) => {
  try {
    const { id } = await (ctx as Ctx).params;

    const comunicado = await prisma.comunicado.findFirst({
      where: { id, contadorId: auth.sub, deletedAt: null },
    });

    if (!comunicado) {
      return NextResponse.json({ message: 'Comunicado não encontrado.' }, { status: 404 });
    }

    const destinatarios = await prisma.comunicadoDestinatario.findMany({
      where:   { comunicadoId: id },
      include: { cliente: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({
      items: destinatarios.map((d) => ({
        clienteId:    d.clienteId,
        nome:         d.cliente.name,
        email:        d.cliente.email,
        lido:         d.lido,
        lidoAt:       d.lidoAt?.toISOString() ?? null,
        confirmado:   d.confirmado,
        confirmadoAt: d.confirmadoAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    logger.error('[GET /comunicados/[id]/destinatarios] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
```

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/comunicados/[id]/confirmar/route.ts \
        app/api/v1/comunicados/[id]/destinatarios/route.ts
git commit -m "feat(comunicados): PATCH /confirmar e GET /destinatarios"
```

---

## Task 6: Hook useComunicados.ts

**Files:**
- Create: `src/presentation/hooks/useComunicados.ts`

- [ ] **Step 1: Criar o hook**

Criar `src/presentation/hooks/useComunicados.ts`:

```typescript
'use client';

import { useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { getSocket } from './useNotificacoes';

// =============================================================================
// Tipos
// =============================================================================

export interface ComunicadoResumoContador {
  id:                 string;
  titulo:             string;
  targeting:          string;
  setor:              string | null;
  exigeConfirmacao:   boolean;
  publicadoAt:        string;
  totalDestinatarios: number;
  totalLidos:         number;
  totalConfirmados:   number;
}

export interface ComunicadoResumoCliente {
  id:               string;
  titulo:           string;
  conteudo:         string;
  exigeConfirmacao: boolean;
  publicadoAt:      string;
  souDestinatario:  boolean;
  lido:             boolean;
  confirmado:       boolean;
}

export interface PayloadNovoComunicado {
  comunicadoId: string;
  titulo:       string;
  contadorNome: string;
}

// =============================================================================
// Fetcher SWR
// =============================================================================

function fetcherComToken(token: string) {
  return async (url: string) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
}

// =============================================================================
// useComunicadosContador — listagem para o CONTADOR
// =============================================================================

export function useComunicadosContador(token: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    token ? ['/api/v1/comunicados', token] : null,
    ([url, t]) => fetcherComToken(t)(url),
    { revalidateOnFocus: false },
  );

  return {
    items:      (data?.items as ComunicadoResumoContador[]) ?? [],
    total:      (data?.total as number) ?? 0,
    isLoading,
    error,
    revalidar:  mutate,
  };
}

// =============================================================================
// useComunicadosCliente — listagem para o CLIENTE + listener novo_comunicado
// =============================================================================

export function useComunicadosCliente(
  token: string | null | undefined,
  onNovoComunicado?: (payload: PayloadNovoComunicado) => void,
) {
  const { data, error, isLoading, mutate } = useSWR(
    token ? ['/api/v1/comunicados', token] : null,
    ([url, t]) => fetcherComToken(t)(url),
    { revalidateOnFocus: false },
  );

  const callbackRef = useCallback(
    (payload: PayloadNovoComunicado) => onNovoComunicado?.(payload),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (payload: PayloadNovoComunicado) => {
      void mutate(); // revalida a lista
      callbackRef(payload);
    };

    socket.on('novo_comunicado', handler);
    return () => { socket.off('novo_comunicado', handler); };
  }, [mutate, callbackRef]);

  return {
    items:     (data?.items as ComunicadoResumoCliente[]) ?? [],
    total:     (data?.total as number) ?? 0,
    isLoading,
    error,
    revalidar: mutate,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/presentation/hooks/useComunicados.ts
git commit -m "feat(comunicados): hook useComunicados com SWR + listener WS"
```

---

## Task 7: Componente NovoComunicadoModal.tsx

**Files:**
- Create: `src/presentation/components/comunicados/NovoComunicadoModal.tsx`

- [ ] **Step 1: Criar o modal**

Criar `src/presentation/components/comunicados/NovoComunicadoModal.tsx`:

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import {
  X, Send, Loader2, Bold, Italic, List, ListOrdered,
  Link2, Users, Building2, CheckSquare, Paperclip,
} from 'lucide-react';

// =============================================================================
// Tipos
// =============================================================================

type Targeting = 'TODOS' | 'SETOR' | 'SELECIONADOS';
type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL';

interface Cliente {
  id:   string;
  nome: string;
}

interface NovoComunicadoModalProps {
  aberto:    boolean;
  token:     string;
  onFechar:  () => void;
  onSucesso: () => void;
}

// =============================================================================
// Barra de ferramentas Tiptap
// =============================================================================

function ToolbarButton({
  onClick, ativo, title, children,
}: { onClick: () => void; ativo?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded text-sm transition-colors ${
        ativo
          ? 'bg-primary/20 text-primary'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

// =============================================================================
// NovoComunicadoModal
// =============================================================================

export function NovoComunicadoModal({ aberto, token, onFechar, onSucesso }: NovoComunicadoModalProps) {
  const [titulo, setTitulo]               = useState('');
  const [targeting, setTargeting]         = useState<Targeting>('TODOS');
  const [setor, setSetor]                 = useState<SetorTipo>('FISCAL');
  const [clientesSelecionados, setCs]     = useState<string[]>([]);
  const [exigeConfirmacao, setExige]      = useState(false);
  const [anexo, setAnexo]                 = useState<File | null>(null);
  const [clientes, setClientes]           = useState<Cliente[]>([]);
  const [enviando, setEnviando]           = useState(false);
  const [erro, setErro]                   = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'min-h-[160px] p-3 text-sm text-gray-900 focus:outline-none',
      },
    },
  });

  // Carregar clientes quando targeting = SELECIONADOS
  useEffect(() => {
    if (targeting !== 'SELECIONADOS' || clientes.length > 0) return;
    fetch('/api/v1/clientes', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { clientes?: { id: string; name: string }[] }) => {
        setClientes((d.clientes ?? []).map((c) => ({ id: c.id, nome: c.name })));
      })
      .catch(() => {});
  }, [targeting, token, clientes.length]);

  const handleFechar = useCallback(() => {
    if (enviando) return;
    setTitulo('');
    setTargeting('TODOS');
    setSetor('FISCAL');
    setCs([]);
    setExige(false);
    setAnexo(null);
    setErro(null);
    editor?.commands.clearContent();
    onFechar();
  }, [enviando, editor, onFechar]);

  const toggleCliente = (id: string) => {
    setCs((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const adicionarLink = () => {
    const url = window.prompt('URL do link:');
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

  const handleEnviar = useCallback(async () => {
    const conteudo = editor?.getHTML() ?? '';
    if (!titulo.trim()) { setErro('Título obrigatório.'); return; }
    if (!conteudo || conteudo === '<p></p>') { setErro('Conteúdo obrigatório.'); return; }
    if (targeting === 'SELECIONADOS' && clientesSelecionados.length === 0) {
      setErro('Selecione ao menos um cliente.');
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      const form = new FormData();
      form.set('titulo',           titulo.trim());
      form.set('conteudo',         conteudo);
      form.set('exigeConfirmacao', String(exigeConfirmacao));
      form.set('targeting',        targeting);
      if (targeting === 'SETOR') form.set('setor', setor);
      clientesSelecionados.forEach((id) => form.append('clienteIds', id));
      if (anexo) form.set('anexo', anexo);

      const res = await fetch('/api/v1/comunicados', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });

      const body = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? `Erro HTTP ${res.status}`);

      onSucesso();
      handleFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao publicar.');
    } finally {
      setEnviando(false);
    }
  }, [titulo, editor, targeting, setor, clientesSelecionados, exigeConfirmacao, anexo, token, onSucesso, handleFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleFechar} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Novo Comunicado</h3>
          <button type="button" onClick={handleFechar} disabled={enviando}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Mudança de prazo IRPF 2026"
              maxLength={255}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Editor Tiptap */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Conteúdo</label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} ativo={editor?.isActive('bold')} title="Negrito">
                  <Bold size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} ativo={editor?.isActive('italic')} title="Itálico">
                  <Italic size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} ativo={editor?.isActive('bulletList')} title="Lista">
                  <List size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor?.chain().focus().toggleOrderedList().run()} ativo={editor?.isActive('orderedList')} title="Lista numerada">
                  <ListOrdered size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={adicionarLink} ativo={editor?.isActive('link')} title="Link">
                  <Link2 size={14} />
                </ToolbarButton>
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Targeting */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Destinatários</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'TODOS' as Targeting, label: 'Todos os clientes', icon: <Users size={14} /> },
                { value: 'SETOR' as Targeting, label: 'Por setor',         icon: <Building2 size={14} /> },
                { value: 'SELECIONADOS' as Targeting, label: 'Selecionar', icon: <CheckSquare size={14} /> },
              ].map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setTargeting(opt.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                    targeting === opt.value
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>

            {targeting === 'SETOR' && (
              <div className="mt-2">
                <select value={setor} onChange={(e) => setSetor(e.target.value as SetorTipo)}
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="FISCAL">Fiscal</option>
                  <option value="PESSOAL">Pessoal</option>
                  <option value="CONTABIL">Contábil</option>
                </select>
              </div>
            )}

            {targeting === 'SELECIONADOS' && (
              <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-50 dark:divide-gray-800">
                {clientes.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">Carregando clientes…</p>
                ) : clientes.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input type="checkbox" checked={clientesSelecionados.includes(c.id)}
                      onChange={() => toggleCliente(c.id)}
                      className="rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{c.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Exigir confirmação */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={exigeConfirmacao} onChange={(e) => setExige(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Exigir confirmação de leitura</span>
          </label>

          {/* Anexo */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Anexo (opcional, máx 50 MB)</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors">
                <Paperclip size={14} />
                {anexo ? anexo.name : 'Selecionar arquivo'}
                <input type="file" className="hidden" onChange={(e) => setAnexo(e.target.files?.[0] ?? null)} />
              </label>
              {anexo && (
                <button type="button" onClick={() => setAnexo(null)}
                  className="text-xs text-gray-400 hover:text-red-500">
                  Remover
                </button>
              )}
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
              {erro}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button type="button" onClick={handleFechar} disabled={enviando}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleEnviar} disabled={enviando}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50">
            {enviando ? <><Loader2 size={14} className="animate-spin" />Publicando…</> : <><Send size={14} />Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/presentation/components/comunicados/NovoComunicadoModal.tsx
git commit -m "feat(comunicados): NovoComunicadoModal com editor Tiptap e targeting"
```

---

## Task 8: Componentes ComunicadoCard + DestinatariosTable

**Files:**
- Create: `src/presentation/components/comunicados/ComunicadoCard.tsx`
- Create: `src/presentation/components/comunicados/DestinatariosTable.tsx`

- [ ] **Step 1: Criar ComunicadoCard.tsx**

Criar `src/presentation/components/comunicados/ComunicadoCard.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { Users, Building2, CheckSquare, CheckCircle2, Eye } from 'lucide-react';
import type { ComunicadoResumoContador, ComunicadoResumoCliente } from '../../hooks/useComunicados';

// =============================================================================
// Card para o CONTADOR
// =============================================================================

interface ComunicadoCardContadorProps {
  comunicado: ComunicadoResumoContador;
}

function badgeTargeting(targeting: string, setor: string | null, total: number) {
  if (targeting === 'TODOS') return 'Todos os clientes';
  if (targeting === 'SETOR') return `Setor ${setor}`;
  return `${total} cliente${total !== 1 ? 's' : ''} selecionado${total !== 1 ? 's' : ''}`;
}

export function ComunicadoCardContador({ comunicado: c }: ComunicadoCardContadorProps) {
  const progressoLidos     = c.totalDestinatarios > 0 ? (c.totalLidos / c.totalDestinatarios) * 100 : 0;
  const progressoConf      = c.totalDestinatarios > 0 ? (c.totalConfirmados / c.totalDestinatarios) * 100 : 0;
  const TargetingIcon      = c.targeting === 'TODOS' ? Users : c.targeting === 'SETOR' ? Building2 : CheckSquare;

  return (
    <Link href={`/comunicados/${c.id}`}
      className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-primary hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.titulo}</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {new Date(c.publicadoAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span className="flex items-center gap-1 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[10px] font-medium text-gray-600 dark:text-gray-400">
          <TargetingIcon size={10} />
          {badgeTargeting(c.targeting, c.setor, c.totalDestinatarios)}
        </span>
      </div>

      {c.totalDestinatarios > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><Eye size={11} /> {c.totalLidos}/{c.totalDestinatarios} leram</span>
            <span>{Math.round(progressoLidos)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressoLidos}%` }} />
          </div>

          {c.exigeConfirmacao && (
            <>
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><CheckCircle2 size={11} /> {c.totalConfirmados}/{c.totalDestinatarios} confirmaram</span>
                <span>{Math.round(progressoConf)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressoConf}%` }} />
              </div>
            </>
          )}
        </div>
      )}
    </Link>
  );
}

// =============================================================================
// Card para o CLIENTE
// =============================================================================

interface ComunicadoCardClienteProps {
  comunicado: ComunicadoResumoCliente;
}

export function ComunicadoCardCliente({ comunicado: c }: ComunicadoCardClienteProps) {
  return (
    <Link href={`/informativos/${c.id}`}
      className={`block rounded-xl border p-4 hover:shadow-sm transition-all ${
        !c.lido && c.souDestinatario
          ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary'
      }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.titulo}</h3>
            {!c.lido && c.souDestinatario && (
              <span className="shrink-0 rounded-full bg-primary text-white text-[9px] font-bold px-2 py-0.5">NOVO</span>
            )}
            {c.exigeConfirmacao && !c.confirmado && c.souDestinatario && (
              <span className="shrink-0 rounded-full bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5">CONFIRMAR</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{c.conteudo}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
            {new Date(c.publicadoAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Criar DestinatariosTable.tsx**

Criar `src/presentation/components/comunicados/DestinatariosTable.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, Minus, Loader2 } from 'lucide-react';

interface Destinatario {
  clienteId:    string;
  nome:         string;
  email:        string;
  lido:         boolean;
  lidoAt:       string | null;
  confirmado:   boolean;
  confirmadoAt: string | null;
}

interface DestinatariosTableProps {
  comunicadoId:     string;
  exigeConfirmacao: boolean;
  token:            string;
}

export function DestinatariosTable({ comunicadoId, exigeConfirmacao, token }: DestinatariosTableProps) {
  const [items, setItems]       = useState<Destinatario[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/comunicados/${comunicadoId}/destinatarios`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d: { items?: Destinatario[] }) => setItems(d.items ?? []))
      .catch(() => setError('Erro ao carregar destinatários.'))
      .finally(() => setLoading(false));
  }, [comunicadoId, token]);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={20} className="animate-spin text-primary" />
    </div>
  );

  if (error) return <p className="text-xs text-red-500 py-4">{error}</p>;

  if (items.length === 0) return (
    <p className="text-xs text-gray-400 py-4">Nenhum destinatário registrado.</p>
  );

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <th className="px-4 py-2.5">Cliente</th>
            <th className="px-4 py-2.5">Leitura</th>
            {exigeConfirmacao && <th className="px-4 py-2.5">Confirmação</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((d) => (
            <tr key={d.clienteId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-gray-900 dark:text-gray-100">{d.nome}</p>
                <p className="text-gray-400 dark:text-gray-500">{d.email}</p>
              </td>
              <td className="px-4 py-3">
                {d.lido ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <Eye size={12} /> Lido em {fmt(d.lidoAt)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-400"><Minus size={12} /> Não lido</span>
                )}
              </td>
              {exigeConfirmacao && (
                <td className="px-4 py-3">
                  {d.confirmado ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 size={12} /> Confirmado em {fmt(d.confirmadoAt)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400"><Minus size={12} /> Pendente</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/presentation/components/comunicados/
git commit -m "feat(comunicados): componentes ComunicadoCard e DestinatariosTable"
```

---

## Task 9: Páginas do Contador (/comunicados)

**Files:**
- Create: `app/(contador)/comunicados/page.tsx`
- Create: `app/(contador)/comunicados/[id]/page.tsx`

- [ ] **Step 1: Criar listagem do contador**

Criar `app/(contador)/comunicados/page.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Plus, Megaphone, Loader2 } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { useComunicadosContador } from '../../../src/presentation/hooks/useComunicados';
import { ComunicadoCardContador } from '../../../src/presentation/components/comunicados/ComunicadoCard';
import { NovoComunicadoModal } from '../../../src/presentation/components/comunicados/NovoComunicadoModal';

export default function ComunicadosPage() {
  const { token } = useAuth();
  const { items, isLoading, error, revalidar } = useComunicadosContador(token);
  const [modalAberto, setModalAberto] = useState(false);

  const handleSucesso = useCallback(() => {
    void revalidar();
  }, [revalidar]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <Megaphone size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Comunicados</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avisos publicados para seus clientes</p>
          </div>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors shadow-sm"
        >
          <Plus size={16} /> Novo Comunicado
        </button>
      </div>

      {/* Lista */}
      {error ? (
        <p className="text-sm text-red-500 text-center py-8">Erro ao carregar comunicados.</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum comunicado publicado</p>
          <p className="text-xs mt-1">Clique em "Novo Comunicado" para criar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ComunicadoCardContador key={c.id} comunicado={c} />
          ))}
        </div>
      )}

      {token && (
        <NovoComunicadoModal
          aberto={modalAberto}
          token={token}
          onFechar={() => setModalAberto(false)}
          onSucesso={handleSucesso}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar página de detalhe do contador**

Criar `app/(contador)/comunicados/[id]/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import { useAuth } from '../../../../src/presentation/hooks/useAuth';
import { DestinatariosTable } from '../../../../src/presentation/components/comunicados/DestinatariosTable';

interface ComunicadoDetalhe {
  id:               string;
  titulo:           string;
  conteudo:         string;
  exigeConfirmacao: boolean;
  targeting:        string;
  setor:            string | null;
  publicadoAt:      string;
  anexoNome:        string | null;
  anexoUrl:         string | null;
}

export default function ComunicadoDetalhePage() {
  const { token } = useAuth();
  const router    = useRouter();
  const params    = useParams<{ id: string }>();
  const id        = params.id;

  const [comunicado, setComunicado] = useState<ComunicadoDetalhe | null>(null);
  const [loading, setLoading]       = useState(true);
  const [erro, setErro]             = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletando, setDeletando]   = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    fetch(`/api/v1/comunicados/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: ComunicadoDetalhe) => setComunicado(d))
      .catch(() => setErro('Comunicado não encontrado.'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleDelete = useCallback(async () => {
    if (!token || !id) return;
    setDeletando(true);
    try {
      const res = await fetch(`/api/v1/comunicados/${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      router.push('/comunicados');
    } catch {
      setErro('Erro ao excluir comunicado.');
      setDeletando(false);
      setConfirmDelete(false);
    }
  }, [token, id, router]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  if (erro || !comunicado) return (
    <div className="p-6 text-center text-red-500">{erro ?? 'Comunicado não encontrado.'}</div>
  );

  const html = DOMPurify.sanitize(comunicado.conteudo);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/comunicados')}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">
          {comunicado.titulo}
        </h1>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span>Publicado em {new Date(comunicado.publicadoAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        {comunicado.exigeConfirmacao && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 font-medium">
            Exige confirmação
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Anexo */}
      {comunicado.anexoUrl && (
        <a href={comunicado.anexoUrl} download={comunicado.anexoNome ?? true} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 w-fit rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors">
          <Download size={14} /> {comunicado.anexoNome ?? 'Baixar anexo'}
        </a>
      )}

      {/* Destinatários */}
      {token && (
        <>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Destinatários</h2>
          <DestinatariosTable
            comunicadoId={id}
            exigeConfirmacao={comunicado.exigeConfirmacao}
            token={token}
          />
        </>
      )}

      {/* Deletar */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 hover:underline">
            <Trash2 size={13} /> Excluir comunicado
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400 flex-1">Confirmar exclusão? Esta ação não pode ser desfeita.</p>
            <button onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancelar</button>
            <button onClick={handleDelete} disabled={deletando}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {deletando ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Excluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(contador\)/comunicados/
git commit -m "feat(comunicados): páginas /comunicados e /comunicados/[id] do contador"
```

---

## Task 10: Páginas do Cliente (/informativos)

**Files:**
- Create: `app/(cliente)/informativos/page.tsx`
- Create: `app/(cliente)/informativos/[id]/page.tsx`

- [ ] **Step 1: Criar listagem do cliente**

Criar `app/(cliente)/informativos/page.tsx`:

```typescript
'use client';

import { useCallback } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { useComunicadosCliente, type PayloadNovoComunicado } from '../../../src/presentation/hooks/useComunicados';
import { ComunicadoCardCliente } from '../../../src/presentation/components/comunicados/ComunicadoCard';

export default function InformativosPage() {
  const { token } = useAuth();
  const router    = useRouter();

  const handleNovo = useCallback((payload: PayloadNovoComunicado) => {
    toast.info(`Novo informativo: ${payload.titulo}`, {
      action: {
        label: 'Ver',
        onClick: () => router.push(`/informativos/${payload.comunicadoId}`),
      },
    });
  }, [router]);

  const { items, isLoading, error } = useComunicadosCliente(token, handleNovo);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <Bell size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Informativos</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Avisos e comunicados do seu escritório</p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-500 text-center py-8">Erro ao carregar informativos.</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum informativo disponível</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ComunicadoCardCliente key={c.id} comunicado={c} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar página de detalhe do cliente**

Criar `app/(cliente)/informativos/[id]/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, CheckCircle2, Loader2 } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import { useAuth } from '../../../../src/presentation/hooks/useAuth';

interface InfoDetalhe {
  id:               string;
  titulo:           string;
  conteudo:         string;
  exigeConfirmacao: boolean;
  publicadoAt:      string;
  anexoNome:        string | null;
  anexoUrl:         string | null;
  souDestinatario:  boolean;
  lido:             boolean;
  confirmado:       boolean;
}

export default function InformativoDetalhePage() {
  const { token }   = useAuth();
  const router      = useRouter();
  const params      = useParams<{ id: string }>();
  const id          = params.id;

  const [info, setInfo]             = useState<InfoDetalhe | null>(null);
  const [loading, setLoading]       = useState(true);
  const [erro, setErro]             = useState<string | null>(null);
  const [confirmando, setConf]      = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    fetch(`/api/v1/comunicados/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: InfoDetalhe) => {
        setInfo(d);
        setConfirmado(d.confirmado);
      })
      .catch(() => setErro('Informativo não encontrado.'))
      .finally(() => setLoading(false));
  }, [token, id]);

  const handleConfirmar = useCallback(async () => {
    if (!token || !id) return;
    setConf(true);
    try {
      const res = await fetch(`/api/v1/comunicados/${id}/confirmar`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setConfirmado(true);
    } catch {
      setErro('Erro ao confirmar. Tente novamente.');
    } finally {
      setConf(false);
    }
  }, [token, id]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  if (erro || !info) return (
    <div className="p-6 text-center text-red-500">{erro ?? 'Informativo não encontrado.'}</div>
  );

  const html = DOMPurify.sanitize(info.conteudo);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Voltar */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/informativos')}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">
          {info.titulo}
        </h1>
      </div>

      {/* Data */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {new Date(info.publicadoAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
      </p>

      {/* Conteúdo */}
      <div
        className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Anexo */}
      {info.anexoUrl && (
        <a href={info.anexoUrl} download={info.anexoNome ?? true} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 w-fit rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors">
          <Download size={14} /> {info.anexoNome ?? 'Baixar anexo'}
        </a>
      )}

      {/* Confirmar leitura */}
      {info.exigeConfirmacao && info.souDestinatario && (
        confirmado ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Você confirmou o recebimento deste informativo.</p>
          </div>
        ) : (
          <button onClick={handleConfirmar} disabled={confirmando}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors disabled:opacity-50 shadow-sm">
            {confirmando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Li e estou ciente
          </button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(cliente\)/informativos/
git commit -m "feat(comunicados): páginas /informativos e /informativos/[id] do cliente"
```

---

## Task 11: Navegação — Links nos layouts

**Files:**
- Modify: `app/(contador)/layout.tsx`
- Modify: `app/(cliente)/layout.tsx`

- [ ] **Step 1: Adicionar import Megaphone no layout do contador**

Em `app/(contador)/layout.tsx`, adicionar `Megaphone` ao import de lucide-react (já existe o bloco de imports no topo do arquivo):

```typescript
  Megaphone,
```

- [ ] **Step 2: Adicionar link no NAV_GROUPS do contador**

Em `app/(contador)/layout.tsx`, dentro do grupo `label: 'Comunicação'`, adicionar após o item do Chat:

```typescript
      { href: '/comunicados', label: 'Comunicados', icon: <Megaphone size={18} /> },
```

O grupo ficará:
```typescript
  {
    label: 'Comunicação',
    items: [
      { href: '/chat',         label: 'Chat',         icon: <MessageSquare size={18} />, feature: 'chat' },
      { href: '/chat-ia',      label: 'Chat IA',      icon: <Bot           size={18} />, donoOnly: true, feature: 'ia' },
      { href: '/comunicados',  label: 'Comunicados',  icon: <Megaphone     size={18} /> },
    ],
  },
```

- [ ] **Step 3: Adicionar import Bell no layout do cliente**

Em `app/(cliente)/layout.tsx`, `Bell` já está importado (usado na topbar de notificações). Adicionar `Megaphone`:

```typescript
  Megaphone,
```

Ao import de lucide-react.

- [ ] **Step 4: Adicionar link no NAV_GROUPS do cliente**

Em `app/(cliente)/layout.tsx`, dentro do grupo `label: 'Comunicação'`, adicionar após o item Chat:

```typescript
      { href: '/informativos', label: 'Informativos', icon: <Megaphone size={18} /> },
```

O grupo ficará:
```typescript
  {
    label: 'Comunicação',
    items: [
      { href: '/chat',         label: 'Chat',         icon: <MessageSquare size={18} /> },
      { href: '/informativos', label: 'Informativos', icon: <Megaphone     size={18} /> },
    ],
  },
```

- [ ] **Step 5: Verificar build TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros. Se houver erros de tipos, corrigir antes de commitar.

- [ ] **Step 6: Commit final**

```bash
git add app/\(contador\)/layout.tsx app/\(cliente\)/layout.tsx
git commit -m "feat(comunicados): adicionar links Comunicados/Informativos na navegação"
```

---

## Checklist de revisão pós-implementação

- [ ] `npx prisma migrate dev` aplicou a migration sem erros
- [ ] `npx tsc --noEmit` retorna zero erros
- [ ] `npm run build` compila sem warnings fatais
- [ ] Testar fluxo completo:
  1. Contador publica comunicado (TODOS)
  2. Cliente recebe toast em tempo real
  3. Cliente abre a página `/informativos/[id]` e marca como lido automaticamente
  4. Comunicado com exigeConfirmacao: cliente vê botão "Li e estou ciente"
  5. Página `/comunicados/[id]` do contador mostra barra de progresso atualizada
  6. Contador exclui comunicado → soft delete, não aparece mais
