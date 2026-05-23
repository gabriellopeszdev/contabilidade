# Features: Email, Recuperação de Senha, Convite, Notificações, CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Resend email adapter, recuperação de senha para contadores, envio real de convite de cliente, correção das notificações in-app, e export CSV de clientes e boletos.

**Architecture:** O adaptador Resend implementa `IEmailService` e é injetado via `Container.ts` com fallback para `ConsoleEmailAdapter` quando `RESEND_API_KEY` não está configurada. Recuperação de senha segue o mesmo padrão do `inviteToken` já existente. Notificações já têm UI completa nos dois layouts — a correção é apenas nos labels dos tipos de evento. CSV é gerado server-side com string pura e retornado como download.

**Tech Stack:** Next.js 14 App Router, Prisma 7 + PostgreSQL, `resend` SDK, bcryptjs, TypeScript

---

## File Map

### Criar
- `src/infrastructure/email/ResendEmailAdapter.ts` — implementação Resend de IEmailService
- `app/api/v1/auth/forgot-password/route.ts` — solicitar reset de senha
- `app/api/v1/auth/reset-password/route.ts` — confirmar reset de senha
- `app/auth/recuperar-senha/page.tsx` — formulário de solicitação
- `app/auth/recuperar-senha/[token]/page.tsx` — formulário de nova senha
- `app/api/v1/clientes/[id]/reenviar-convite/route.ts` — reenviar convite
- `app/api/v1/clientes/export/route.ts` — CSV de clientes
- `app/api/v1/financeiro/boletos/export/route.ts` — CSV de boletos
- `src/utils/csv.ts` — utilitário de geração CSV

### Modificar
- `src/domain/ports/IEmailService.ts` — adicionar 2 novos métodos
- `src/infrastructure/email/ConsoleEmailAdapter.ts` — implementar stubs dos 2 novos métodos
- `src/infrastructure/di/Container.ts` — exportar `emailService`
- `prisma/schema.prisma` — campos `resetToken` e `resetTokenExpiresAt` em UsuarioContador
- `app/api/v1/clientes/route.ts` — enviar email no POST + expor `activatedAt` no GET
- `app/(contador)/clientes/page.tsx` — badge Pendente + botão Reenviar + botão CSV
- `app/(contador)/layout.tsx` — corrigir labels de todos os tipos de notificação
- `app/(cliente)/layout.tsx` — idem
- `app/financeiro/page.tsx` — adicionar botão CSV
- `app/page.tsx` — link "Esqueci minha senha"

---

## Task 1: Instalar Resend SDK e configurar env vars

**Files:**
- Modify: `package.json` (via npm)
- Modify: `.env`

- [ ] **Step 1: Instalar dependência**

```bash
cd "C:/Users/lopee/OneDrive/Desktop/contabilidade"
npm install resend
```

Expected: `added 1 package` (ou similar, sem erros)

- [ ] **Step 2: Adicionar variáveis ao .env**

Abrir `.env` e adicionar ao final:

```
RESEND_API_KEY=re_SUA_CHAVE_AQUI
RESEND_FROM_EMAIL=noreply@seudominio.com.br
```

> Nota: sem a `RESEND_API_KEY`, o sistema usa `ConsoleEmailAdapter` automaticamente.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install resend SDK"
```

---

## Task 2: Atualizar IEmailService com novos métodos

**Files:**
- Modify: `src/domain/ports/IEmailService.ts`

- [ ] **Step 1: Adicionar interfaces e métodos**

Substituir o conteúdo completo de `src/domain/ports/IEmailService.ts` por:

```typescript
export interface EnviarEmailDTO {
  destinatario: string;
  assunto: string;
  corpoHtml: string;
  corpoTexto?: string;
}

export interface NovoDocumentoEmailParams {
  emailCliente:  string;
  nomeCliente:   string;
  nomeArquivo:   string;
  setor:         string;
  urlPortal:     string;
}

export interface BoasVindasEmailParams {
  emailCliente:   string;
  nomeCliente:    string;
  nomeEscritorio: string;
  urlPortal:      string;
}

export interface RecuperacaoSenhaEmailParams {
  email: string;
  link:  string;
}

export interface ConviteClienteEmailParams {
  email: string;
  nome:  string;
  link:  string;
}

export interface IEmailService {
  enviar(dto: EnviarEmailDTO): Promise<void>;
  enviarNovoDocumentoDisponivel(params: NovoDocumentoEmailParams): Promise<void>;
  enviarBoasVindas(params: BoasVindasEmailParams): Promise<void>;
  enviarRecuperacaoSenha(params: RecuperacaoSenhaEmailParams): Promise<void>;
  enviarConviteCliente(params: ConviteClienteEmailParams): Promise<void>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/ports/IEmailService.ts
git commit -m "feat: add enviarRecuperacaoSenha and enviarConviteCliente to IEmailService"
```

---

## Task 3: Adicionar stubs ao ConsoleEmailAdapter

**Files:**
- Modify: `src/infrastructure/email/ConsoleEmailAdapter.ts`

- [ ] **Step 1: Atualizar imports e adicionar métodos**

No final da classe `ConsoleEmailAdapter`, antes do fechamento `}`, adicionar os dois métodos. Primeiro atualizar o import para incluir os novos tipos:

```typescript
import type {
  IEmailService,
  EnviarEmailDTO,
  NovoDocumentoEmailParams,
  BoasVindasEmailParams,
  RecuperacaoSenhaEmailParams,
  ConviteClienteEmailParams,
} from '../../domain/ports/IEmailService';
```

Em seguida, após o método `enviarBoasVindas`, adicionar:

```typescript
  async enviarRecuperacaoSenha(params: RecuperacaoSenhaEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Redefinição de senha</h2>
      <p>Clique no botão abaixo para redefinir sua senha. O link expira em 2 horas.</p>
      <p>
        <a href="${params.link}" style="
          background:#7c3aed;color:#fff;padding:12px 24px;
          border-radius:6px;text-decoration:none;font-weight:bold;
        ">Redefinir senha</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Se você não solicitou a redefinição, ignore este e-mail.</p>
    `.trim();

    await this.enviar({
      destinatario: params.email,
      assunto:      '[Portal Contábil] Redefinição de senha',
      corpoHtml,
      corpoTexto:   `Redefinir senha: ${params.link}`,
    });
  }

  async enviarConviteCliente(params: ConviteClienteEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Olá, ${params.nome}!</h2>
      <p>Você foi convidado para acessar o Portal do Cliente do seu escritório de contabilidade.</p>
      <p>Clique no botão abaixo para criar sua senha e ativar sua conta. O link expira em 48 horas.</p>
      <p>
        <a href="${params.link}" style="
          background:#16a34a;color:#fff;padding:12px 24px;
          border-radius:6px;text-decoration:none;font-weight:bold;
        ">Ativar minha conta</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Este é um e-mail automático. Não responda a esta mensagem.</p>
    `.trim();

    await this.enviar({
      destinatario: params.email,
      assunto:      '[Portal Contábil] Convite para acessar seu portal',
      corpoHtml,
      corpoTexto:   `Olá, ${params.nome}! Ative sua conta em: ${params.link}`,
    });
  }
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "C:/Users/lopee/OneDrive/Desktop/contabilidade"
npx tsc --noEmit 2>&1 | head -30
```

Expected: sem erros em `ConsoleEmailAdapter.ts`

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/email/ConsoleEmailAdapter.ts
git commit -m "feat: implement enviarRecuperacaoSenha and enviarConviteCliente in ConsoleEmailAdapter"
```

---

## Task 4: Criar ResendEmailAdapter

**Files:**
- Create: `src/infrastructure/email/ResendEmailAdapter.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { Resend } from 'resend';
import type {
  IEmailService,
  EnviarEmailDTO,
  NovoDocumentoEmailParams,
  BoasVindasEmailParams,
  RecuperacaoSenhaEmailParams,
  ConviteClienteEmailParams,
} from '../../domain/ports/IEmailService';
import type { ILogger } from '../../domain/ports/ILogger';

export class ResendEmailAdapter implements IEmailService {
  private readonly client: Resend;

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly logger: ILogger,
  ) {
    this.client = new Resend(apiKey);
  }

  async enviar(dto: EnviarEmailDTO): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.fromEmail,
      to:   dto.destinatario,
      subject: dto.assunto,
      html: dto.corpoHtml,
      text: dto.corpoTexto,
    });

    if (error) {
      this.logger.error('[ResendEmailAdapter] Falha ao enviar e-mail.', { error });
      throw new Error(`Resend error: ${error.message}`);
    }

    this.logger.info('[ResendEmailAdapter] E-mail enviado.', { destinatario: dto.destinatario, assunto: dto.assunto });
  }

  async enviarNovoDocumentoDisponivel(params: NovoDocumentoEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Olá, ${params.nomeCliente}!</h2>
      <p>Um novo documento foi disponibilizado no seu portal:</p>
      <ul>
        <li><strong>Arquivo:</strong> ${params.nomeArquivo}</li>
        <li><strong>Setor:</strong> ${params.setor}</li>
      </ul>
      <p>
        <a href="${params.urlPortal}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Acessar Portal</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Este é um e-mail automático. Não responda a esta mensagem.</p>
    `.trim();

    await this.enviar({
      destinatario: params.emailCliente,
      assunto:      `[Portal Contábil] Novo documento disponível: ${params.nomeArquivo}`,
      corpoHtml,
      corpoTexto:   `Olá, ${params.nomeCliente}! Novo documento: ${params.nomeArquivo} (${params.setor}). Acesse: ${params.urlPortal}`,
    });
  }

  async enviarBoasVindas(params: BoasVindasEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Bem-vindo ao portal do ${params.nomeEscritorio}, ${params.nomeCliente}!</h2>
      <p>Seu acesso ao portal de documentos fiscais foi criado com sucesso.</p>
      <p>
        <a href="${params.urlPortal}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Acessar Portal</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Em caso de dúvidas, entre em contato com o seu contador.</p>
    `.trim();

    await this.enviar({
      destinatario: params.emailCliente,
      assunto:      `Bem-vindo ao Portal — ${params.nomeEscritorio}`,
      corpoHtml,
      corpoTexto:   `Bem-vindo, ${params.nomeCliente}! Acesse: ${params.urlPortal}`,
    });
  }

  async enviarRecuperacaoSenha(params: RecuperacaoSenhaEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Redefinição de senha</h2>
      <p>Clique no botão abaixo para redefinir sua senha. O link expira em 2 horas.</p>
      <p>
        <a href="${params.link}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Redefinir senha</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Se você não solicitou a redefinição, ignore este e-mail.</p>
    `.trim();

    await this.enviar({
      destinatario: params.email,
      assunto:      '[Portal Contábil] Redefinição de senha',
      corpoHtml,
      corpoTexto:   `Redefinir senha: ${params.link}`,
    });
  }

  async enviarConviteCliente(params: ConviteClienteEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Olá, ${params.nome}!</h2>
      <p>Você foi convidado para acessar o Portal do Cliente do seu escritório de contabilidade.</p>
      <p>Clique no botão abaixo para criar sua senha e ativar sua conta. O link expira em 48 horas.</p>
      <p>
        <a href="${params.link}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Ativar minha conta</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Este é um e-mail automático. Não responda a esta mensagem.</p>
    `.trim();

    await this.enviar({
      destinatario: params.email,
      assunto:      '[Portal Contábil] Convite para acessar seu portal',
      corpoHtml,
      corpoTexto:   `Olá, ${params.nome}! Ative sua conta em: ${params.link}`,
    });
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/email/ResendEmailAdapter.ts
git commit -m "feat: implement ResendEmailAdapter"
```

---

## Task 5: Exportar emailService do Container.ts

**Files:**
- Modify: `src/infrastructure/di/Container.ts`

- [ ] **Step 1: Adicionar imports no topo do arquivo**

Logo após os imports existentes (após `import { PinoLogger } ...`), adicionar:

```typescript
import { ConsoleEmailAdapter } from '../email/ConsoleEmailAdapter';
import { ResendEmailAdapter }  from '../email/ResendEmailAdapter';
import type { IEmailService }  from '../../domain/ports/IEmailService';
```

- [ ] **Step 2: Adicionar função buildEmailService**

Após a função `buildMinioClient()`, adicionar:

```typescript
function buildEmailService(): IEmailService {
  const apiKey   = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@contabilidade.app';
  if (apiKey) {
    return new ResendEmailAdapter(apiKey, fromEmail, logger);
  }
  return new ConsoleEmailAdapter(logger);
}
```

- [ ] **Step 3: Instanciar e exportar**

Na seção de exportações no final do arquivo, adicionar `emailService`:

```typescript
export const emailService: IEmailService = buildEmailService();
```

Adicionar também à linha de exportações finais existente:

Localizar a linha:
```typescript
export { prisma, redisPublisher, storageService, documentoRepository };
```

Substituir por:
```typescript
export { prisma, redisPublisher, storageService, documentoRepository, emailService };
```

Wait — `emailService` já foi exportado com `export const` acima, então não precisa estar nessa linha. Apenas adicionar o `export const emailService` é suficiente.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/di/Container.ts
git commit -m "feat: wire emailService into Container with Resend/Console fallback"
```

---

## Task 6: Prisma migration — campos resetToken no UsuarioContador

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos ao model UsuarioContador**

Em `prisma/schema.prisma`, no model `UsuarioContador`, após o campo `deletedAt`:

```prisma
  resetToken          String?   @unique @map("reset_token") @db.VarChar(255)
  resetTokenExpiresAt DateTime? @map("reset_token_expires_at") @db.Timestamptz
```

- [ ] **Step 2: Criar migration**

```bash
cd "C:/Users/lopee/OneDrive/Desktop/contabilidade"
npx prisma migrate dev --name add_reset_token_to_usuario_contador
```

Expected: `The following migration(s) have been applied: .../add_reset_token_to_usuario_contador`

- [ ] **Step 3: Verificar TypeScript (gera novo Prisma Client)**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add resetToken and resetTokenExpiresAt to UsuarioContador"
```

---

## Task 7: POST /api/v1/auth/forgot-password

**Files:**
- Create: `app/api/v1/auth/forgot-password/route.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes }               from 'node:crypto';
import { prisma }                    from '../../../../../src/infrastructure/di/Container';
import { emailService }              from '../../../../../src/infrastructure/di/Container';
import { logger }                    from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESET_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 horas

// POST /api/v1/auth/forgot-password
// Body: { email: string }
// Resposta: sempre 200 { ok: true } (não revela se e-mail existe)
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ message: 'Body inválido.' }, { status: 400 }); }

    const { email } = body as { email?: string };
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ message: 'E-mail é obrigatório.' }, { status: 400 });
    }

    const contador = await prisma.usuarioContador.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: { id: true, email: true },
    });

    // Sempre retorna 200 para não revelar se o e-mail existe
    if (!contador) {
      return NextResponse.json({ ok: true });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);

    await prisma.usuarioContador.update({
      where: { id: contador.id },
      data:  { resetToken: token, resetTokenExpiresAt: expiresAt },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const link   = `${appUrl}/auth/recuperar-senha/${token}`;

    try {
      await emailService.enviarRecuperacaoSenha({ email: contador.email, link });
    } catch (emailErr) {
      logger.error('[POST /auth/forgot-password] Falha ao enviar e-mail.', emailErr instanceof Error ? emailErr : undefined);
      // Não reverte — token já está salvo; o usuário pode tentar novamente
    }

    logger.info('[POST /auth/forgot-password] Token gerado.', { contadorId: contador.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /auth/forgot-password] Erro interno.', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "forgot-password" | head -10
```

Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add "app/api/v1/auth/forgot-password/route.ts"
git commit -m "feat: POST /api/v1/auth/forgot-password"
```

---

## Task 8: POST /api/v1/auth/reset-password

**Files:**
- Create: `app/api/v1/auth/reset-password/route.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { NextRequest, NextResponse }      from 'next/server';
import { prisma }                          from '../../../../../src/infrastructure/di/Container';
import { logger }                          from '../../../../../src/utils/logger';
import { BcryptPasswordHasher }            from '../../../../../src/infrastructure/auth/BcryptPasswordHasher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hasher = new BcryptPasswordHasher();

// POST /api/v1/auth/reset-password
// Body: { token: string, novaSenha: string }
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ message: 'Body inválido.' }, { status: 400 }); }

    const { token, novaSenha } = body as { token?: string; novaSenha?: string };

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ message: 'Token é obrigatório.' }, { status: 400 });
    }
    if (!novaSenha || typeof novaSenha !== 'string' || novaSenha.length < 8) {
      return NextResponse.json({ message: 'A senha deve ter no mínimo 8 caracteres.' }, { status: 422 });
    }

    const contador = await prisma.usuarioContador.findFirst({
      where: { resetToken: token, deletedAt: null },
      select: { id: true, resetTokenExpiresAt: true },
    });

    if (!contador) {
      return NextResponse.json({ message: 'Link de redefinição inválido ou já utilizado.' }, { status: 404 });
    }

    if (contador.resetTokenExpiresAt && contador.resetTokenExpiresAt < new Date()) {
      return NextResponse.json({ message: 'Link expirado. Solicite um novo link de redefinição.' }, { status: 410 });
    }

    const passwordHash = await hasher.hash(novaSenha);

    await prisma.usuarioContador.update({
      where: { id: contador.id },
      data:  {
        passwordHash,
        resetToken:          null,
        resetTokenExpiresAt: null,
      },
    });

    logger.info('[POST /auth/reset-password] Senha redefinida.', { contadorId: contador.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /auth/reset-password] Erro interno.', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "reset-password" | head -10
```

Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add "app/api/v1/auth/reset-password/route.ts"
git commit -m "feat: POST /api/v1/auth/reset-password"
```

---

## Task 9: Página /auth/recuperar-senha (formulário de solicitação)

**Files:**
- Create: `app/auth/recuperar-senha/page.tsx`

- [ ] **Step 1: Criar o arquivo**

```typescript
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Building2, Mail, Loader2, CheckCircle2 } from 'lucide-react';

export default function RecuperarSenhaPage() {
  const [email,    setEmail]    = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);
  const [erro,     setErro]     = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');

    try {
      await fetch('/api/v1/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      // Sempre mostra sucesso (não revela se e-mail existe)
      setEnviado(true);
    } catch {
      setErro('Falha na conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar senha</h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            Informe seu e-mail e enviaremos um link de redefinição
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {enviado ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm text-gray-700 text-center font-medium">
                Se esse e-mail estiver cadastrado, você receberá o link em breve.
              </p>
              <p className="text-xs text-gray-400 text-center">
                Verifique sua caixa de entrada e a pasta de spam.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contador@escritorio.com.br"
                    className="input pl-9"
                  />
                </div>
              </div>

              {erro && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {erro}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando || !email}
                className="btn-primary w-full"
              >
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {enviando ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link href="/" className="text-xs text-blue-600 hover:underline">
              ← Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/auth/recuperar-senha/page.tsx"
git commit -m "feat: page /auth/recuperar-senha"
```

---

## Task 10: Página /auth/recuperar-senha/[token] (nova senha)

**Files:**
- Create: `app/auth/recuperar-senha/[token]/page.tsx`

- [ ] **Step 1: Criar o arquivo**

```typescript
'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter }     from 'next/navigation';
import Link                          from 'next/link';
import { Building2, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function RedefinirSenhaPage() {
  const params  = useParams<{ token: string }>();
  const router  = useRouter();
  const token   = params.token;

  const [novaSenha,      setNovaSenha]      = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [enviando,       setEnviando]       = useState(false);
  const [sucesso,        setSucesso]        = useState(false);
  const [erro,           setErro]           = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro('');

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, novaSenha }),
      });

      if (res.ok) {
        setSucesso(true);
        setTimeout(() => router.push('/?msg=senha-redefinida'), 2000);
      } else {
        const data = await res.json() as { message?: string };
        setErro(data.message ?? 'Erro ao redefinir a senha. O link pode ter expirado.');
      }
    } catch {
      setErro('Falha na conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Building2 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Nova senha</h1>
          <p className="text-slate-400 text-sm mt-1">Defina sua nova senha de acesso</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sucesso ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="text-sm text-gray-700 font-medium">Senha redefinida com sucesso!</p>
              <p className="text-xs text-gray-400">Redirecionando para o login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="novaSenha" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nova senha
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="novaSenha"
                    type="password"
                    required
                    minLength={8}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="input pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmarSenha" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirmar senha
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="confirmarSenha"
                    type="password"
                    required
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="input pl-9"
                  />
                </div>
              </div>

              {erro && (
                <div role="alert" className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={enviando || !novaSenha || !confirmarSenha}
                className="btn-primary w-full"
              >
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {enviando ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          )}

          {!sucesso && (
            <div className="mt-5 text-center">
              <Link href="/auth/recuperar-senha" className="text-xs text-blue-600 hover:underline">
                Solicitar novo link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/auth/recuperar-senha/[token]/page.tsx"
git commit -m "feat: page /auth/recuperar-senha/[token]"
```

---

## Task 11: Link "Esqueci minha senha" na página de login

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Adicionar link após o botão de submit**

Em `app/page.tsx`, localizar o bloco do botão de submit:

```tsx
            <button
              type="submit"
              disabled={enviando || !email || !senha}
              className="btn-primary w-full"
            >
              {enviando && <Loader2 size={15} className="animate-spin" />}
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
```

Substituir por:

```tsx
            <button
              type="submit"
              disabled={enviando || !email || !senha}
              className="btn-primary w-full"
            >
              {enviando && <Loader2 size={15} className="animate-spin" />}
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>

            <div className="text-center">
              <a
                href="/auth/recuperar-senha"
                className="text-xs text-blue-600 hover:underline"
              >
                Esqueci minha senha
              </a>
            </div>
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add 'Esqueci minha senha' link to login page"
```

---

## Task 12: Enviar e-mail de convite no POST /api/v1/clientes + expor activatedAt no GET

**Files:**
- Modify: `app/api/v1/clientes/route.ts`

- [ ] **Step 1: Adicionar import de emailService**

No topo do arquivo, junto aos imports existentes, adicionar:

```typescript
import { emailService } from '../../../../src/infrastructure/di/Container';
```

- [ ] **Step 2: Substituir o bloco de log de simulação pelo envio real**

Localizar o bloco:

```typescript
    // Simular envio de e-mail de convite via logger (Módulo 3 - Onboarding)
    const inviteLink = `/auth/ativar-conta?token=${inviteToken}`;
    logger.info(`[SIMULAÇÃO] E-mail de convite enviado para ${email.toLowerCase()} — Link: ${inviteLink}`, {
      event: 'INVITE_EMAIL_SENT',
      to: email.toLowerCase(),
      clienteId: cliente.id,
      inviteLink,
      expiresAt: inviteExpiresAt.toISOString(),
    });
```

Substituir por:

```typescript
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/auth/ativar-conta?token=${inviteToken}`;

    try {
      await emailService.enviarConviteCliente({ email: email.toLowerCase(), nome, link: inviteLink });
      logger.info('[POST /clientes] E-mail de convite enviado.', { clienteId: cliente.id });
    } catch (emailErr) {
      logger.error('[POST /clientes] Falha ao enviar e-mail de convite.', emailErr instanceof Error ? emailErr : undefined);
      // Não reverte — cliente foi criado com sucesso
    }
```

- [ ] **Step 3: Expor activatedAt no GET**

Na query do `GET`, no bloco `select` do `cliente`, adicionar `activatedAt`:

```typescript
        cliente: {
          select: {
            id:          true,
            name:        true,
            email:       true,
            cnpj:        true,
            phone:       true,
            avatarUrl:   true,
            isActive:    true,
            activatedAt: true,   // <- adicionar
            createdAt:   true,
          },
        },
```

E no mapeamento do retorno, adicionar o campo:

```typescript
    const clientes = relacoes.map((r) => ({
      id:          r.cliente.id,
      nome:        r.cliente.name,
      email:       r.cliente.email,
      cnpj:        r.cliente.cnpj,
      phone:       r.cliente.phone,
      avatarUrl:   r.cliente.avatarUrl,
      isActive:    r.cliente.isActive,
      activatedAt: r.cliente.activatedAt?.toISOString() ?? null,   // <- adicionar
      assignedAt:  r.assignedAt.toISOString(),
      createdAt:   r.cliente.createdAt.toISOString(),
    }));
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "clientes/route" | head -10
```

Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add "app/api/v1/clientes/route.ts"
git commit -m "feat: send real invite email in POST /clientes, expose activatedAt in GET"
```

---

## Task 13: POST /api/v1/clientes/[id]/reenviar-convite

**Files:**
- Create: `app/api/v1/clientes/[id]/reenviar-convite/route.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes }               from 'node:crypto';
import { withAuth }                  from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma, emailService }      from '../../../../../../src/infrastructure/di/Container';
import { logger }                    from '../../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 horas

// POST /api/v1/clientes/:id/reenviar-convite
// Gera novo inviteToken e reenvia o e-mail de ativação para clientes não ativados.
export const POST = withAuth(async (_req: NextRequest, ctx, auth) => {
  try {
    const { id } = await Promise.resolve(ctx.params as { id: string });
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    // Verifica vínculo entre o contador e o cliente
    const vinculo = await prisma.contadorCliente.findFirst({
      where: { contadorId, clienteId: id },
      select: { clienteId: true },
    });
    if (!vinculo) {
      return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
    }

    const cliente = await prisma.usuarioCliente.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, email: true, activatedAt: true },
    });
    if (!cliente) {
      return NextResponse.json({ message: 'Cliente não encontrado.' }, { status: 404 });
    }

    if (cliente.activatedAt) {
      return NextResponse.json({ message: 'Esta conta já foi ativada.' }, { status: 400 });
    }

    const inviteToken    = randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    await prisma.usuarioCliente.update({
      where: { id: cliente.id },
      data:  { inviteToken, inviteExpiresAt },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const link   = `${appUrl}/auth/ativar-conta?token=${inviteToken}`;

    try {
      await emailService.enviarConviteCliente({ email: cliente.email, nome: cliente.name, link });
    } catch (emailErr) {
      logger.error('[POST /clientes/:id/reenviar-convite] Falha ao enviar e-mail.', emailErr instanceof Error ? emailErr : undefined);
    }

    logger.info('[POST /clientes/:id/reenviar-convite] Convite reenviado.', { clienteId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[POST /clientes/:id/reenviar-convite] Erro interno.', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "reenviar" | head -10
```

Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add "app/api/v1/clientes/[id]/reenviar-convite/route.ts"
git commit -m "feat: POST /api/v1/clientes/:id/reenviar-convite"
```

---

## Task 14: Atualizar página de Clientes — badge Pendente + botão Reenviar

**Files:**
- Modify: `app/(contador)/clientes/page.tsx`

- [ ] **Step 1: Adicionar `activatedAt` ao tipo `ClienteDTO`**

Localizar:
```typescript
interface ClienteDTO {
  id:         string;
  nome:       string;
  email:      string;
  cnpj:       string;
  phone:      string | null;
  avatarUrl:  string | null;
  isActive:   boolean;
  assignedAt: string;
  createdAt:  string;
}
```

Substituir por:
```typescript
interface ClienteDTO {
  id:          string;
  nome:        string;
  email:       string;
  cnpj:        string;
  phone:       string | null;
  avatarUrl:   string | null;
  isActive:    boolean;
  activatedAt: string | null;
  assignedAt:  string;
  createdAt:   string;
}
```

- [ ] **Step 2: Adicionar imports de ícones**

Adicionar `Send` ao import do lucide-react na linha de imports:
```typescript
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  Building2,
  Mail,
  Phone,
  Eye,
  Send,       // <- adicionar
  Download,   // <- adicionar
} from 'lucide-react';
```

- [ ] **Step 3: Adicionar estado e handler para reenvio**

Após os estados existentes no componente principal, adicionar:

```typescript
  const [reenviando, setReenviando] = useState<string | null>(null); // clienteId sendo reenviado

  const handleReenviarConvite = useCallback(async (clienteId: string) => {
    if (!token) return;
    setReenviando(clienteId);
    try {
      const res = await fetch(`/api/v1/clientes/${clienteId}/reenviar-convite`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert('Convite reenviado com sucesso!');
      } else {
        const data = await res.json() as { message?: string };
        alert(data.message ?? 'Erro ao reenviar convite.');
      }
    } catch {
      alert('Falha na conexão.');
    } finally {
      setReenviando(null);
    }
  }, [token]);
```

- [ ] **Step 4: Adicionar badge e botão Reenviar na tabela/lista de clientes**

Localizar onde o status `isActive` do cliente é exibido na tabela e adicionar, logo abaixo do badge de status existente:

```tsx
{!cliente.activatedAt && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
    Pendente
  </span>
)}
```

E no bloco de ações de cada linha, adicionar o botão de reenvio:

```tsx
{!cliente.activatedAt && (
  <button
    onClick={() => handleReenviarConvite(cliente.id)}
    disabled={reenviando === cliente.id}
    title="Reenviar convite"
    className="p-1.5 rounded-md text-amber-500 hover:bg-amber-50 hover:text-amber-700 transition-colors disabled:opacity-50"
  >
    {reenviando === cliente.id
      ? <Loader2 size={14} className="animate-spin" />
      : <Send size={14} />}
  </button>
)}
```

- [ ] **Step 5: Adicionar botão "Exportar CSV" no header da página**

Localizar a área de toolbar/header da página de clientes e adicionar o botão de download. O handler fará o fetch e download:

```tsx
  const handleExportarCSV = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/clientes/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert('Erro ao exportar.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'clientes.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Falha na conexão.');
    }
  }, [token]);
```

No JSX, no canto superior direito ao lado do botão "Novo Cliente" (ou onde for mais adequado):

```tsx
<button
  onClick={handleExportarCSV}
  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
>
  <Download size={14} />
  Exportar CSV
</button>
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "clientes/page" | head -10
```

Expected: sem erros

- [ ] **Step 7: Commit**

```bash
git add "app/(contador)/clientes/page.tsx"
git commit -m "feat: add Pendente badge, reenviar convite, and CSV export to clientes page"
```

---

## Task 15: Corrigir labels de notificação nos dois layouts

**Files:**
- Modify: `app/(contador)/layout.tsx`
- Modify: `app/(cliente)/layout.tsx`

- [ ] **Step 1: Corrigir layout do contador**

Em `app/(contador)/layout.tsx`, localizar o bloco dentro do dropdown de notificações:

```tsx
                          <p className="text-[11px] font-semibold text-gray-800">
                            {n.tipo === 'novoDocumentoUpload' ? 'Upload concluído' : 'Documento visualizado'}
                          </p>
```

Substituir por:

```tsx
                          <p className="text-[11px] font-semibold text-gray-800">
                            {n.tipo === 'novoDocumentoUpload'  ? 'Upload concluído'
                            : n.tipo === 'documentoVisualizado' ? 'Documento visualizado'
                            : n.tipo === 'novoBoletoHonorario'  ? 'Novo honorário'
                            : n.tipo === 'chat_notification'    ? 'Mensagem no chat'
                            : 'Notificação'}
                          </p>
```

- [ ] **Step 2: Corrigir layout do cliente**

Em `app/(cliente)/layout.tsx`, localizar o mesmo bloco:

```tsx
                          <p className="text-[11px] font-semibold text-gray-800">
                            {n.tipo === 'novoDocumentoUpload' ? 'Upload concluído' : 'Documento visualizado'}
                          </p>
```

Substituir por:

```tsx
                          <p className="text-[11px] font-semibold text-gray-800">
                            {n.tipo === 'novoDocumentoUpload'  ? 'Documento disponível'
                            : n.tipo === 'documentoVisualizado' ? 'Documento visualizado'
                            : n.tipo === 'novoBoletoHonorario'  ? 'Novo honorário'
                            : n.tipo === 'chat_notification'    ? 'Mensagem no chat'
                            : 'Notificação'}
                          </p>
```

- [ ] **Step 3: Commit**

```bash
git add "app/(contador)/layout.tsx" "app/(cliente)/layout.tsx"
git commit -m "fix: display correct titles for all notification types in both layouts"
```

---

## Task 16: Utilitário CSV

**Files:**
- Create: `src/utils/csv.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// RFC 4180: escapa campos que contenham vírgulas, aspas ou quebras de linha
function escaparCampo(valor: string): string {
  if (valor.includes('"') || valor.includes(',') || valor.includes('\n')) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function toCSV(headers: string[], rows: string[][]): string {
  const linhas = [
    headers.map(escaparCampo).join(','),
    ...rows.map((row) => row.map(escaparCampo).join(',')),
  ];
  return linhas.join('\r\n');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/csv.ts
git commit -m "feat: add toCSV utility following RFC 4180"
```

---

## Task 17: GET /api/v1/clientes/export

**Files:**
- Create: `app/api/v1/clientes/export/route.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth }                  from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                    from '../../../../../src/infrastructure/di/Container';
import { logger }                    from '../../../../../src/utils/logger';
import { toCSV }                     from '../../../../../src/utils/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/clientes/export
// Retorna CSV com todos os clientes do escritório (sem paginação).
export const GET = withAuth(async (_req: NextRequest, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const relacoes = await prisma.contadorCliente.findMany({
      where: { contadorId, cliente: { deletedAt: null } },
      select: {
        cliente: {
          select: {
            name:        true,
            email:       true,
            cnpj:        true,
            isActive:    true,
            activatedAt: true,
            createdAt:   true,
          },
        },
      },
      orderBy: { cliente: { name: 'asc' } },
    });

    function formatCNPJ(cnpj: string): string {
      return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    const headers = ['Nome', 'Email', 'CNPJ', 'Status', 'Ativado em', 'Criado em'];
    const rows = relacoes.map(({ cliente: c }) => [
      c.name,
      c.email,
      formatCNPJ(c.cnpj),
      c.isActive ? 'Ativo' : 'Inativo',
      c.activatedAt ? new Date(c.activatedAt).toLocaleDateString('pt-BR') : 'Pendente',
      new Date(c.createdAt).toLocaleDateString('pt-BR'),
    ]);

    const csv = toCSV(headers, rows);

    return new NextResponse(csv, {
      status:  200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="clientes.csv"',
      },
    });
  } catch (err) {
    logger.error('[GET /clientes/export] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "clientes/export" | head -10
```

Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add "app/api/v1/clientes/export/route.ts"
git commit -m "feat: GET /api/v1/clientes/export — CSV download"
```

---

## Task 18: GET /api/v1/financeiro/boletos/export

**Files:**
- Create: `app/api/v1/financeiro/boletos/export/route.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth }                  from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                    from '../../../../../../src/infrastructure/di/Container';
import { logger }                    from '../../../../../../src/utils/logger';
import { toCSV }                     from '../../../../../../src/utils/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/financeiro/boletos/export
// Retorna CSV com todos os boletos do escritório (sem paginação).
export const GET = withAuth(async (_req: NextRequest, _ctx, auth) => {
  try {
    const contadorId = auth.role === 'EMPLOYEE' ? auth.superiorId! : auth.sub;

    const boletos = await prisma.boletoHonorario.findMany({
      where:   { escritorioId: contadorId },
      include: { cliente: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    function formatMoney(v: unknown): string {
      return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    const headers = ['Cliente', 'Referência', 'Valor', 'Status', 'Tipo', 'Vencimento', 'Criado em'];
    const rows = boletos.map((b) => [
      b.cliente.name,
      b.mesReferencia,
      formatMoney(b.valor),
      b.status,
      b.tipoPagamento,
      new Date(b.vencimento).toLocaleDateString('pt-BR'),
      new Date(b.createdAt).toLocaleDateString('pt-BR'),
    ]);

    const csv = toCSV(headers, rows);

    return new NextResponse(csv, {
      status:  200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="boletos.csv"',
      },
    });
  } catch (err) {
    logger.error('[GET /financeiro/boletos/export] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}, ['ACCOUNTANT']);
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "boletos/export" | head -10
```

Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add "app/api/v1/financeiro/boletos/export/route.ts"
git commit -m "feat: GET /api/v1/financeiro/boletos/export — CSV download"
```

---

## Task 19: Botão CSV na página de financeiro

**Files:**
- Modify: `app/financeiro/page.tsx`

- [ ] **Step 1: Adicionar handler de export no componente principal**

Em `app/financeiro/page.tsx`, logo após a declaração do componente `FinanceiroPage` e dos estados existentes, adicionar:

```typescript
  const { token } = useAuth();

  const handleExportarCSV = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/financeiro/boletos/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert('Erro ao exportar.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'boletos.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Falha na conexão.');
    }
  }, [token]);
```

> Verificar se `token` já está disponível via `useAuth()` na página — se o hook já for chamado, apenas adicionar `token` à desestruturação existente.

- [ ] **Step 2: Adicionar botão na toolbar dos boletos**

Localizar o bloco da toolbar dos boletos (onde está o botão "Novo Honorário"):

```tsx
          {/* Botão novo boleto */}
          {isDono && isVisaoContador && (
            <button
              onClick={() => { setErros({}); setFormErro(''); setModalAberto(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              Novo Honorário
            </button>
          )}
```

Adicionar o botão de CSV antes do "Novo Honorário":

```tsx
          {isVisaoContador && (
            <button
              onClick={handleExportarCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors"
            >
              <Download size={14} />
              Exportar CSV
            </button>
          )}
```

Certificar que `Download` está nos imports do lucide-react (já estava, mas verificar).

- [ ] **Step 3: Adicionar `useCallback` ao import do React se não estiver**

Verificar se `useCallback` está no import:
```bash
head -5 "C:/Users/lopee/OneDrive/Desktop/contabilidade/app/financeiro/page.tsx"
```

Se não estiver, adicionar à lista de imports do React.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "financeiro/page" | head -10
```

Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add "app/financeiro/page.tsx"
git commit -m "feat: add CSV export button to financeiro page"
```

---

## Task 20: Verificação final

- [ ] **Step 1: Build completo**

```bash
cd "C:/Users/lopee/OneDrive/Desktop/contabilidade"
npm run build 2>&1 | tail -20
```

Expected: `Route (app) ... compiled successfully` sem erros de tipo ou build.

- [ ] **Step 2: Verificar rotas criadas**

```bash
npm run build 2>&1 | grep -E "auth/forgot|auth/reset|auth/recuperar|reenviar|export"
```

Expected: todas as novas rotas aparecem no output do build.

- [ ] **Step 3: Smoke test manual**

1. Abrir `http://localhost:3000`
2. Clicar em "Esqueci minha senha" → deve ir para `/auth/recuperar-senha`
3. Preencher um e-mail e submeter → deve mostrar mensagem de sucesso
4. Entrar como contador → acessar `/clientes` → verificar badge "Pendente" em clientes não ativados
5. Clicar em "Exportar CSV" → deve baixar `clientes.csv`
6. Acessar `/financeiro` → clicar em "Exportar CSV" → deve baixar `boletos.csv`
7. Abrir uma notificação de boleto → título deve ser "Novo honorário"

- [ ] **Step 4: Commit final de ajustes (se houver)**

```bash
git add -A
git commit -m "fix: post-integration adjustments"
```
