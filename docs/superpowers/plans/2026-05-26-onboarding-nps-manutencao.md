# Onboarding + NPS + Modo Manutenção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Checklist de onboarding guiado no primeiro login de contadores. (2) Survey NPS automático após 7 dias de uso. (3) Banner de modo manutenção ativável via variável de ambiente ou config no banco.

**Architecture:** Onboarding: campo `onboardingStep` no UsuarioContador + componente flutuante de checklist. NPS: tabela `NpsResponse` + modal exibido uma vez por trimestre. Manutenção: variável `MAINTENANCE_MODE=true` no .env lida no middleware proxy.ts → redireciona não-admins para página estática.

**Tech Stack:** Prisma, Next.js, sem dependências novas.

---

## Arquivo Map

| Ação | Arquivo |
|------|---------|
| Modify | `prisma/schema.prisma` |
| Create | `app/api/v1/onboarding/route.ts` |
| Create | `app/api/v1/nps/route.ts` |
| Create | `app/(contador)/components/OnboardingChecklist.tsx` |
| Create | `app/(contador)/components/NpsModal.tsx` |
| Modify | `proxy.ts` |
| Create | `app/manutencao/page.tsx` |

---

## Task 1: Schema — onboarding e NPS

- [ ] **Step 1: Adicionar campos ao UsuarioContador**

Em `prisma/schema.prisma`, dentro de `model UsuarioContador`:

```prisma
  onboardingConcluido Boolean  @default(false) @map("onboarding_concluido")
  onboardingPassos    String[] @map("onboarding_passos") // passos já concluídos
  primeiroLoginEm     DateTime? @map("primeiro_login_em") @db.Timestamptz
```

- [ ] **Step 2: Adicionar model NpsResponse**

```prisma
model NpsResponse {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  userType   String   @map("user_type") @db.VarChar(20) // CONTADOR | CLIENTE
  score      Int      // 0-10
  comentario String?  @db.VarChar(1000)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId])
  @@index([createdAt])
  @@map("nps_response")
}
```

- [ ] **Step 3: Migrar**

```bash
npx prisma migrate dev --name add_onboarding_nps
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(onboarding): add onboarding fields and NpsResponse table"
```

---

## Task 2: API de onboarding

**Files:**
- Create: `app/api/v1/onboarding/route.ts`

- [ ] **Step 1: Criar rotas GET e PATCH**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';

// Passos de onboarding disponíveis — ordem importa
export const PASSOS_ONBOARDING = [
  { id: 'configurar-escritorio', titulo: 'Configure seu escritório', descricao: 'Adicione nome, logo e cores em Configurações', href: '/configuracoes' },
  { id: 'adicionar-cliente',     titulo: 'Adicione seu primeiro cliente', descricao: 'Cadastre um cliente na sua carteira', href: '/clientes' },
  { id: 'enviar-documento',      titulo: 'Envie um documento', descricao: 'Faça upload de um documento fiscal', href: '/lote' },
  { id: 'criar-obrigacao',       titulo: 'Configure o calendário fiscal', descricao: 'Adicione obrigações recorrentes', href: '/calendario' },
  { id: 'explorar-kanban',       titulo: 'Explore o Kanban', descricao: 'Gerencie tarefas no quadro Kanban', href: '/dashboard' },
] as const;

// GET — retorna status do onboarding
export const GET = withAuth(async (req, ctx) => {
  const contador = await prisma.usuarioContador.findUnique({
    where: { id: ctx.auth.sub },
    select: { onboardingPassos: true, onboardingConcluido: true },
  });

  if (!contador) return NextResponse.json({ message: 'Não encontrado' }, { status: 404 });

  const passosCompletos = contador.onboardingPassos;
  const passos = PASSOS_ONBOARDING.map((p) => ({ ...p, concluido: passosCompletos.includes(p.id) }));
  const totalConcluidos = passosCompletos.length;

  return NextResponse.json({ passos, totalConcluidos, total: PASSOS_ONBOARDING.length, concluido: contador.onboardingConcluido });
}, ['ACCOUNTANT']);

// PATCH — marcar passo como concluído
export const PATCH = withAuth(async (req, ctx) => {
  const { passoId, concluirTudo } = await req.json();

  const contador = await prisma.usuarioContador.findUnique({
    where: { id: ctx.auth.sub },
    select: { onboardingPassos: true },
  });
  if (!contador) return NextResponse.json({ message: 'Não encontrado' }, { status: 404 });

  if (concluirTudo) {
    await prisma.usuarioContador.update({
      where: { id: ctx.auth.sub },
      data: { onboardingConcluido: true },
    });
    return NextResponse.json({ message: 'Onboarding concluído' });
  }

  const passoValido = PASSOS_ONBOARDING.find((p) => p.id === passoId);
  if (!passoValido) return NextResponse.json({ message: 'Passo inválido' }, { status: 400 });

  const novosPassos = [...new Set([...contador.onboardingPassos, passoId])];
  const todosCompletos = PASSOS_ONBOARDING.every((p) => novosPassos.includes(p.id));

  await prisma.usuarioContador.update({
    where: { id: ctx.auth.sub },
    data: { onboardingPassos: novosPassos, onboardingConcluido: todosCompletos },
  });

  return NextResponse.json({ passosCompletos: novosPassos, concluido: todosCompletos });
}, ['ACCOUNTANT']);
```

- [ ] **Step 2: Registrar primeiroLoginEm na rota de login**

Na `app/api/v1/auth/login/route.ts`, após login bem-sucedido de um contador, se `primeiroLoginEm` for null, fazer update:

```typescript
if (!contador.primeiroLoginEm) {
  await prisma.usuarioContador.update({
    where: { id: contador.id },
    data: { primeiroLoginEm: new Date() },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/onboarding/
git commit -m "feat(onboarding): add GET/PATCH onboarding API and track primeiroLoginEm"
```

---

## Task 3: Componente OnboardingChecklist

**Files:**
- Create: `app/(contador)/components/OnboardingChecklist.tsx`

- [ ] **Step 1: Criar componente flutuante**

```tsx
'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function OnboardingChecklist() {
  const [aberto, setAberto] = useState(true);
  const { data, mutate } = useSWR('/api/v1/onboarding', fetcher);

  if (!data || data.concluido) return null;

  const progressoPct = Math.round((data.totalConcluidos / data.total) * 100);

  async function marcarConcluido(passoId: string) {
    await fetch('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passoId }),
    });
    mutate();
  }

  async function dispensar() {
    await fetch('/api/v1/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concluirTudo: true }),
    });
    mutate();
  }

  if (!aberto) return (
    <button onClick={() => setAberto(true)} className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full px-4 py-2 shadow-lg text-sm font-medium z-50">
      🚀 Primeiros passos ({data.totalConcluidos}/{data.total})
    </button>
  );

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white rounded-xl shadow-2xl border z-50">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">🚀 Primeiros passos</h3>
          <p className="text-xs text-muted-foreground">{data.totalConcluidos} de {data.total} concluídos</p>
        </div>
        <button onClick={() => setAberto(false)} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="p-2 h-1 bg-gray-100"><div className="h-1 bg-blue-600 rounded transition-all" style={{ width: `${progressoPct}%` }} /></div>
      <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
        {data.passos.map((p: { id: string; titulo: string; descricao: string; href: string; concluido: boolean }) => (
          <div key={p.id} className={`flex gap-3 items-start ${p.concluido ? 'opacity-50' : ''}`}>
            <button onClick={() => marcarConcluido(p.id)} className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 ${p.concluido ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
              {p.concluido && <span className="text-white text-xs">✓</span>}
            </button>
            <div>
              <Link href={p.href} className="text-sm font-medium hover:underline">{p.titulo}</Link>
              <p className="text-xs text-muted-foreground">{p.descricao}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <button onClick={dispensar} className="text-xs text-muted-foreground hover:underline w-full text-center">Não mostrar mais</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar ao layout do contador**

Encontre `app/(contador)/layout.tsx` e adicione `<OnboardingChecklist />` antes do fechamento do body.

- [ ] **Step 3: Commit**

```bash
git add app/\(contador\)/
git commit -m "feat(onboarding): add floating OnboardingChecklist component"
```

---

## Task 4: NPS

**Files:**
- Create: `app/api/v1/nps/route.ts`
- Create: `app/(contador)/components/NpsModal.tsx`

- [ ] **Step 1: Criar API NPS**

```typescript
// app/api/v1/nps/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';

// GET — verificar se deve exibir NPS
export const GET = withAuth(async (req, ctx) => {
  // Exibir NPS se: primeiro login foi há > 7 dias E não respondeu nos últimos 90 dias
  const contador = await prisma.usuarioContador.findUnique({
    where: { id: ctx.auth.sub },
    select: { primeiroLoginEm: true },
  });

  if (!contador?.primeiroLoginEm) return NextResponse.json({ exibir: false });

  const diasDesdeLogin = (Date.now() - contador.primeiroLoginEm.getTime()) / (1000 * 60 * 60 * 24);
  if (diasDesdeLogin < 7) return NextResponse.json({ exibir: false });

  const ultimaResposta = await prisma.npsResponse.findFirst({
    where: { userId: ctx.auth.sub },
    orderBy: { createdAt: 'desc' },
  });

  if (ultimaResposta) {
    const diasDesdeResposta = (Date.now() - ultimaResposta.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diasDesdeResposta < 90) return NextResponse.json({ exibir: false });
  }

  return NextResponse.json({ exibir: true });
}, ['ACCOUNTANT', 'CLIENT']);

// POST — salvar resposta NPS
export const POST = withAuth(async (req, ctx) => {
  const { score, comentario } = await req.json();

  if (typeof score !== 'number' || score < 0 || score > 10) {
    return NextResponse.json({ message: 'Score deve ser entre 0 e 10' }, { status: 400 });
  }

  await prisma.npsResponse.create({
    data: {
      userId:    ctx.auth.sub,
      userType:  ctx.auth.role === 'ACCOUNTANT' ? 'CONTADOR' : 'CLIENTE',
      score,
      comentario: comentario?.slice(0, 1000),
    },
  });

  return NextResponse.json({ message: 'Obrigado pelo feedback!' });
}, ['ACCOUNTANT', 'CLIENT']);
```

- [ ] **Step 2: Criar NpsModal**

```tsx
'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function NpsModal() {
  const { data } = useSWR('/api/v1/nps', fetcher);
  const [score, setScore]         = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado]     = useState(false);
  const [visivel, setVisivel]     = useState(false);

  useEffect(() => { if (data?.exibir) setVisivel(true); }, [data]);

  if (!visivel || enviado) return null;

  async function enviar() {
    if (score === null) return;
    await fetch('/api/v1/nps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, comentario }),
    });
    setEnviado(true);
    setTimeout(() => setVisivel(false), 2000);
  }

  const labelScore = score === null ? '' : score <= 6 ? '😟 Detrator' : score <= 8 ? '😐 Neutro' : '😊 Promotor';

  return (
    <div className="fixed bottom-6 left-6 w-96 bg-white rounded-xl shadow-2xl border z-50 p-6 space-y-4">
      <button onClick={() => setVisivel(false)} className="absolute top-3 right-3 text-muted-foreground">✕</button>
      <div>
        <h3 className="font-semibold">Como você avalia o Konto?</h3>
        <p className="text-sm text-muted-foreground">De 0 a 10, qual a probabilidade de indicar para um colega?</p>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} onClick={() => setScore(i)}
            className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${score === i ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
            {i}
          </button>
        ))}
      </div>
      {score !== null && <p className="text-sm text-center">{labelScore}</p>}
      <textarea value={comentario} onChange={(e) => setComentario(e.target.value)}
        placeholder="Comentário opcional..." rows={2}
        className="w-full border rounded p-2 text-sm resize-none" />
      <button onClick={enviar} disabled={score === null}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50">
        Enviar feedback
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar ao layout do contador**

Adicionar `<NpsModal />` ao `app/(contador)/layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/api/v1/nps/ app/\(contador\)/components/NpsModal.tsx app/\(contador\)/layout.tsx
git commit -m "feat(nps): add NPS survey modal shown after 7 days, repeats every 90 days"
```

---

## Task 5: Modo manutenção

**Files:**
- Modify: `proxy.ts`
- Create: `app/manutencao/page.tsx`

- [ ] **Step 1: Adicionar verificação no proxy.ts**

No início da função `proxy`, antes de qualquer outra lógica:

```typescript
// Modo manutenção — bloqueia acesso de não-admins
if (process.env.MAINTENANCE_MODE === 'true') {
  const { pathname } = request.nextUrl;

  // Permitir: página de manutenção, assets estáticos, APIs de autenticação
  const isPublic = pathname.startsWith('/manutencao') ||
                   pathname.startsWith('/_next') ||
                   pathname.startsWith('/api/v1/auth/login');

  if (!isPublic) {
    // Verificar se é admin
    const authHeader = request.headers.get('Authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) token = request.cookies.get('contabilidade_jwt')?.value ?? null;

    let isAdmin = false;
    if (token) {
      try {
        const key = new TextEncoder().encode(process.env.JWT_SECRET!);
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        isAdmin = (payload as Record<string, unknown>).role === 'ADMIN';
      } catch {}
    }

    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/manutencao';
      return NextResponse.redirect(url);
    }
  }
}
```

- [ ] **Step 2: Criar página de manutenção**

```tsx
// app/manutencao/page.tsx
export default function ManutencaoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="text-8xl">🔧</div>
        <h1 className="text-3xl font-bold text-gray-900">Em Manutenção</h1>
        <p className="text-gray-500 text-lg">Estamos atualizando o sistema para melhorar sua experiência. Voltaremos em breve!</p>
        <p className="text-gray-400 text-sm">Se você é administrador, faça login normalmente.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar MAINTENANCE_MODE ao .env.example (se existir)**

Verificar se existe `.env.example` e adicionar:
```
MAINTENANCE_MODE=false
```

- [ ] **Step 4: Commit**

```bash
git add proxy.ts app/manutencao/
git commit -m "feat(manutencao): add maintenance mode via MAINTENANCE_MODE env var"
```

---

## Verificação final

- [ ] Primeiro login do contador → checklist aparece
- [ ] Marcar passo como concluído → checkbox fica marcado
- [ ] Concluir todos os passos → checklist some
- [ ] Após 7 dias (simular mudando `primeiroLoginEm` no banco) → NPS aparece
- [ ] Responder NPS → modal some, não aparece antes de 90 dias
- [ ] Setar `MAINTENANCE_MODE=true` no .env → não-admins redirecionados para /manutencao
- [ ] Admin acessa normalmente com `MAINTENANCE_MODE=true`
- [ ] `npm run build` sem erros
