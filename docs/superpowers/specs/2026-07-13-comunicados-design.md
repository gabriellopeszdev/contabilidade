# Comunicados / Informativos — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Contador publica avisos (comunicados) para seus clientes com targeting flexível, confirmação de leitura opcional e entrega em tempo real via sino. Clientes visualizam os avisos na página "Informativos".

**Architecture:** Nova feature com duas tabelas Prisma (`Comunicado` + `ComunicadoDestinatario`), 6 endpoints REST, entrega via Socket.IO existente, e duas áreas na UI (contador: `/comunicados`; cliente: `/informativos`).

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Socket.IO + Redis, MinIO (anexos), Tiptap (editor rico), Tailwind CSS, SWR, Lucide React.

---

## Data Model

### Tabela `Comunicado`

```prisma
model Comunicado {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  contadorId        String    @db.Uuid
  titulo            String
  conteudo          String    // HTML gerado pelo Tiptap
  anexoPath         String?   // path no MinIO
  anexoNome         String?   // nome original do arquivo
  exigeConfirmacao  Boolean   @default(false)
  publicadoAt       DateTime  @default(now())
  deletedAt         DateTime?

  contador          UsuarioContador          @relation(fields: [contadorId], references: [id])
  destinatarios     ComunicadoDestinatario[]

  @@index([contadorId])
  @@index([publicadoAt])
  @@map("comunicados")
}
```

### Tabela `ComunicadoDestinatario`

```prisma
model ComunicadoDestinatario {
  comunicadoId  String    @db.Uuid
  clienteId     String    @db.Uuid
  lido          Boolean   @default(false)
  lidoAt        DateTime?
  confirmado    Boolean   @default(false)
  confirmadoAt  DateTime?

  comunicado    Comunicado      @relation(fields: [comunicadoId], references: [id])
  cliente       UsuarioCliente  @relation(fields: [clienteId], references: [id])

  @@id([comunicadoId, clienteId])
  @@map("comunicado_destinatarios")
}
```

---

## Targeting

Ao publicar, o contador escolhe um dos três modos:

| Modo | Descrição |
|------|-----------|
| `TODOS` | Todos os clientes da carteira do contador |
| `SETOR` | Clientes que possuem pelo menos um documento no setor (FISCAL, PESSOAL, CONTABIL) |
| `SELECIONADOS` | Lista explícita de `clienteId[]` |

O backend resolve os destinatários no momento da publicação e insere as linhas em `ComunicadoDestinatario`. Targeting é imutável após a publicação.

**Clientes que entram depois:** veem todos os comunicados do contador publicados após a data do vínculo `ContadorCliente.createdAt`, mas sem linha em `ComunicadoDestinatario` — portanto sem sino e sem rastreamento de leitura/confirmação.

---

## API Endpoints

### `POST /api/v1/comunicados`
- **Roles:** `ACCOUNTANT`
- **Body (multipart/form-data):**
  - `titulo: string`
  - `conteudo: string` (HTML)
  - `exigeConfirmacao: boolean`
  - `targeting: 'TODOS' | 'SETOR' | 'SELECIONADOS'`
  - `setor?: 'FISCAL' | 'PESSOAL' | 'CONTABIL'` (quando targeting = SETOR)
  - `clienteIds?: string[]` (quando targeting = SELECIONADOS)
  - `anexo?: File` (opcional)
- **Ação:**
  1. Valida campos
  2. Se anexo: faz upload para MinIO em `comunicados/{contadorId}/{uuid}/{filename}`
  3. Cria `Comunicado`
  4. Resolve destinatários → cria `ComunicadoDestinatario` em batch
  5. Para cada destinatário: emite `novo_comunicado` via Socket.IO no room `user:{clienteId}` e cria `Notificacao`
- **Response:** `{ id, titulo, totalDestinatarios }`

### `GET /api/v1/comunicados`
- **Roles:** `ACCOUNTANT`, `CLIENT`
- **Contador:** retorna comunicados onde `contadorId = auth.sub`, ordenados por `publicadoAt DESC`, com contagem de lidos e confirmados
- **Cliente:** retorna comunicados do contador dele publicados após `ContadorCliente.createdAt`, com flag `souDestinatario`, `lido`, `confirmado`
- **Query params:** `page`, `perPage` (padrão 20)

### `GET /api/v1/comunicados/[id]`
- **Roles:** `ACCOUNTANT`, `CLIENT`
- **Contador:** retorna comunicado com `contadorId = auth.sub`
- **Cliente:** retorna comunicado do contador dele; se é destinatário e `lido = false`, marca `lido = true` e `lidoAt = now()` automaticamente
- **Response:** comunicado completo + `anexoUrl` (presigned URL MinIO se houver)

### `PATCH /api/v1/comunicados/[id]/confirmar`
- **Roles:** `CLIENT`
- **Valida:** cliente é destinatário + `exigeConfirmacao = true` + `confirmado = false`
- **Ação:** `confirmado = true`, `confirmadoAt = now()`
- **Response:** `{ ok: true }`

### `GET /api/v1/comunicados/[id]/destinatarios`
- **Roles:** `ACCOUNTANT`
- **Valida:** `contadorId = auth.sub`
- **Response:** lista de destinatários com `{ clienteId, nome, lido, lidoAt, confirmado, confirmadoAt }`

### `DELETE /api/v1/comunicados/[id]`
- **Roles:** `ACCOUNTANT`
- **Valida:** `contadorId = auth.sub`
- **Ação:** soft delete (`deletedAt = now()`)
- **Response:** `{ ok: true }`

---

## Real-Time (Socket.IO)

Evento emitido para cada destinatário no room `user:{clienteId}`:

```typescript
// Evento: novo_comunicado
{
  comunicadoId: string;
  titulo:       string;
  contadorNome: string;
}
```

Além do evento Socket.IO, cria linha em `Notificacao` com:
- `tipo: 'COMUNICADO'`
- `titulo: 'Novo comunicado: {titulo}'`
- `mensagem: trecho do conteúdo (primeiros 120 chars, sem HTML)`
- `metadados: { comunicadoId }`

---

## Frontend — Contador (`/(contador)/comunicados/`)

### Listagem (`page.tsx`)
- Cards com: título, data de publicação, badge de targeting ("Todos" / "Setor Fiscal" / "3 clientes selecionados")
- Barra de progresso: "8/12 leram" e "5/12 confirmaram" (só se `exigeConfirmacao`)
- Botão "Novo Comunicado" abre modal de criação
- Clique no card navega para `/comunicados/[id]`

### Modal de criação (`NovoComunicadoModal.tsx`)
- Campo título
- Editor Tiptap (negrito, itálico, listas ordenadas/não-ordenadas, links)
- Seletor de targeting: radio group com 3 opções
  - "Todos os clientes" — sem campos extras
  - "Por setor" — dropdown FISCAL / PESSOAL / CONTABIL
  - "Selecionar clientes" — lista com checkbox por cliente
- Toggle "Exigir confirmação de leitura"
- Upload de anexo (opcional) — um arquivo, qualquer tipo, máx 50 MB
- Botões: Cancelar / Publicar

### Detalhe (`/comunicados/[id]/page.tsx`)
- Comunicado completo renderizado (dangerouslySetInnerHTML com sanitização)
- Link de download do anexo se houver
- Tabela de destinatários: nome do cliente, "Lido em XX/XX" ou "Não lido", "Confirmado em XX/XX" ou "—"
- Botão soft delete (com confirmação dupla)

---

## Frontend — Cliente (`/(cliente)/informativos/`)

### Listagem (`page.tsx`)
- Feed cronológico reverso
- Badge "NOVO" nos não lidos (destinatários que não leram)
- Badge "CONFIRMAR" nos que exigem confirmação e o cliente ainda não confirmou
- Título, trecho do conteúdo (sem HTML, 120 chars), data

### Detalhe (`/informativos/[id]/page.tsx`)
- Conteúdo completo renderizado
- Link de download do anexo se houver
- Botão "Li e estou ciente" (só aparece se `exigeConfirmacao = true` e `confirmado = false`)
- Ao abrir a página, marca lido automaticamente (via GET /api/v1/comunicados/[id])

### Sino
- Hook `useComunicados` escuta evento `novo_comunicado` via Socket.IO
- Exibe toast: "Novo informativo: [título]" com link para `/informativos/[id]`
- Incrementa contador de não lidos no ícone de sino existente

---

## Sanitização HTML

O conteúdo salvo pelo Tiptap é HTML. Antes de renderizar no cliente, sanitizar com `dompurify` para evitar XSS:

```typescript
import DOMPurify from 'isomorphic-dompurify';
const html = DOMPurify.sanitize(comunicado.conteudo);
```

---

## Arquivos a Criar/Modificar

### Novos
- `prisma/migrations/YYYYMMDD_add_comunicados/migration.sql`
- `app/api/v1/comunicados/route.ts` — GET + POST
- `app/api/v1/comunicados/[id]/route.ts` — GET + DELETE
- `app/api/v1/comunicados/[id]/confirmar/route.ts` — PATCH
- `app/api/v1/comunicados/[id]/destinatarios/route.ts` — GET
- `app/(contador)/comunicados/page.tsx`
- `app/(contador)/comunicados/[id]/page.tsx`
- `app/(cliente)/informativos/page.tsx`
- `app/(cliente)/informativos/[id]/page.tsx`
- `src/presentation/components/comunicados/NovoComunicadoModal.tsx`
- `src/presentation/components/comunicados/ComunicadoCard.tsx`
- `src/presentation/components/comunicados/DestinatariosTable.tsx`
- `src/presentation/hooks/useComunicados.ts`

### Modificar
- `prisma/schema.prisma` — adicionar modelos `Comunicado` e `ComunicadoDestinatario` + relações em `UsuarioContador` e `UsuarioCliente`
- `src/infrastructure/websockets/SocketServer.ts` — adicionar evento `novo_comunicado` ao tipo `ServerToClientEvents`
- Menus laterais do contador e do cliente — adicionar links "Comunicados" e "Informativos"
- `Notificacao` tipo enum — adicionar `COMUNICADO` se necessário
