# Notificações por E-mail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disparar emails automáticos quando documentos são enviados e corrigir o lembrete de boleto para respeitar preferências do usuário e evitar duplicatas.

**Architecture:** Campos booleanos de preferência adicionados diretamente às tabelas `UsuarioContador`, `UsuarioCliente` e `BoletoHonorario` via migration Prisma. Emails disparados fire-and-forget nas rotas de upload. Job de boleto corrigido com flag `lembreteEnviado`. Endpoint PATCH/GET dedicado para preferências. Novo tab no configurações do contador e nova página de configurações do cliente.

**Tech Stack:** Prisma 5 (migration), TypeScript, Resend via IEmailService, BullMQ, Next.js App Router API routes, React 18, Tailwind CSS, Lucide React.

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | Modificar — adicionar 4 campos |
| `src/domain/ports/IEmailService.ts` | Modificar — nova interface + método |
| `src/infrastructure/email/ResendEmailAdapter.ts` | Modificar — implementar método |
| `src/infrastructure/email/ConsoleEmailAdapter.ts` | Modificar — stub do método |
| `src/infrastructure/queue/jobs/verificarLembretesJob.ts` | Modificar — aceitar emailService |
| `src/infrastructure/queue/BullMQAdapter.ts` | Modificar — passar emailService + corrigir boleto |
| `app/api/v1/documentos/lote/route.ts` | Modificar — fire-and-forget email ao cliente |
| `app/api/v1/documentos/cliente-upload/route.ts` | Modificar — usar método tipado + checar preferência |
| `app/api/v1/auth/preferencias-notificacao/route.ts` | Criar — GET e PATCH de preferências |
| `app/(contador)/configuracoes/page.tsx` | Modificar — adicionar tab Notificações |
| `app/(cliente)/configuracoes/page.tsx` | Criar — página de configurações do cliente |
| `app/(cliente)/layout.tsx` | Modificar — adicionar link Configurações |

---

## Task 1: Prisma schema — 4 novos campos

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar campos em `UsuarioCliente`**

Localizar o bloco `model UsuarioCliente` em `prisma/schema.prisma`. Inserir as duas linhas **antes** da linha `@@index([email])`:

```prisma
  notifEmailNovoDoc Boolean   @default(true) @map("notif_email_novo_doc")
  notifEmailBoleto  Boolean   @default(true) @map("notif_email_boleto")
```

O trecho final do model deve ficar assim:

```prisma
  twoFactorBackupCodes String[]  @map("two_factor_backup_codes")

  notifEmailNovoDoc Boolean   @default(true) @map("notif_email_novo_doc")
  notifEmailBoleto  Boolean   @default(true) @map("notif_email_boleto")

  @@index([email])
  @@index([deletedAt])
  @@map("usuario_cliente")
}
```

- [ ] **Step 2: Adicionar campo em `UsuarioContador`**

Localizar o bloco `model UsuarioContador`. Inserir **antes** da linha `// Relações`:

```prisma
  notifEmailNovoDoc Boolean   @default(true) @map("notif_email_novo_doc")
```

O trecho deve ficar:

```prisma
  primeiroLoginEm     DateTime? @map("primeiro_login_em") @db.Timestamptz

  notifEmailNovoDoc Boolean   @default(true) @map("notif_email_novo_doc")

  // Relações
  clientesRel   ContadorCliente[]
```

- [ ] **Step 3: Adicionar campo em `BoletoHonorario`**

Localizar `model BoletoHonorario`. Inserir **antes** da linha `createdAt`:

```prisma
  lembreteEnviado Boolean      @default(false) @map("lembrete_enviado")
```

O trecho deve ficar:

```prisma
  coraPixPayload String? @map("cora_pix_payload")  @db.Text
  lembreteEnviado Boolean      @default(false) @map("lembrete_enviado")
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz
```

- [ ] **Step 4: Gerar e aplicar a migration**

```bash
npx prisma migrate dev --name notif_email_prefs
```

Saída esperada:
```
Your database is now in sync with your Prisma schema.
✔  Generated Prisma Client
```

- [ ] **Step 5: Verificar tipos gerados**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Saída esperada: sem erros relacionados a `notifEmailNovoDoc`, `notifEmailBoleto` ou `lembreteEnviado`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: adicionar campos de preferências de notificação email e lembrete_enviado no boleto"
```

---

## Task 2: Camada de email — nova interface e implementações

**Files:**
- Modify: `src/domain/ports/IEmailService.ts`
- Modify: `src/infrastructure/email/ResendEmailAdapter.ts`
- Modify: `src/infrastructure/email/ConsoleEmailAdapter.ts`

- [ ] **Step 1: Adicionar interface e método em `IEmailService.ts`**

Adicionar logo antes da linha `export interface IEmailService {`:

```typescript
export interface NovoDocumentoContadorEmailParams {
  emailContador: string;
  nomeContador:  string;
  nomeCliente:   string;
  nomeArquivo:   string;
  setor:         string;
  urlPortal:     string;
}
```

Adicionar o método dentro de `IEmailService`, após `enviarStatusAssinatura`:

```typescript
  enviarNovoDocumentoContador(params: NovoDocumentoContadorEmailParams): Promise<void>;
```

O arquivo final deve terminar assim:

```typescript
export interface IEmailService {
  enviar(dto: EnviarEmailDTO): Promise<void>;
  enviarOtpAssinatura(params: OtpAssinaturaEmailParams): Promise<void>;
  enviarNovoDocumentoDisponivel(params: NovoDocumentoEmailParams): Promise<void>;
  enviarBoasVindas(params: BoasVindasEmailParams): Promise<void>;
  enviarRecuperacaoSenha(params: RecuperacaoSenhaEmailParams): Promise<void>;
  enviarConviteCliente(params: ConviteClienteEmailParams): Promise<void>;
  enviarSolicitacaoAssinatura(params: SolicitacaoAssinaturaEmailParams): Promise<void>;
  enviarStatusAssinatura(params: StatusAssinaturaEmailParams): Promise<void>;
  enviarNovoDocumentoContador(params: NovoDocumentoContadorEmailParams): Promise<void>;
}
```

- [ ] **Step 2: Implementar em `ResendEmailAdapter.ts`**

No topo do arquivo, adicionar `NovoDocumentoContadorEmailParams` ao import de `IEmailService.ts`:

```typescript
import type {
  IEmailService,
  EnviarEmailDTO,
  NovoDocumentoEmailParams,
  NovoDocumentoContadorEmailParams,
  BoasVindasEmailParams,
  RecuperacaoSenhaEmailParams,
  ConviteClienteEmailParams,
  SolicitacaoAssinaturaEmailParams,
  StatusAssinaturaEmailParams,
  OtpAssinaturaEmailParams,
} from '../../domain/ports/IEmailService';
```

Adicionar o método ao final da classe, antes do fechamento `}`:

```typescript
  async enviarNovoDocumentoContador(params: NovoDocumentoContadorEmailParams): Promise<void> {
    const corpoHtml = emailWrapper(
      emailHeading(`${params.nomeCliente} enviou um documento`) +
      emailSubheading('Novo Documento Recebido') +
      emailText(
        `O cliente <strong>${params.nomeCliente}</strong> enviou um novo documento para sua análise.`,
      ) +
      emailInfoBox([
        ['Arquivo', params.nomeArquivo],
        ['Setor',   params.setor],
      ]) +
      emailButton('Ver no Painel', `${params.urlPortal}/kanban`),
    );

    await this.enviar({
      destinatario: params.emailContador,
      assunto:      `Novo documento recebido de ${params.nomeCliente}`,
      corpoHtml,
      corpoTexto:   `${params.nomeCliente} enviou "${params.nomeArquivo}" (${params.setor}). Acesse: ${params.urlPortal}/kanban`,
    });
  }
```

- [ ] **Step 3: Adicionar stub em `ConsoleEmailAdapter.ts`**

Adicionar o import de `NovoDocumentoContadorEmailParams` no topo:

```typescript
import type {
  IEmailService,
  EnviarEmailDTO,
  NovoDocumentoEmailParams,
  NovoDocumentoContadorEmailParams,
  BoasVindasEmailParams,
  RecuperacaoSenhaEmailParams,
  ConviteClienteEmailParams,
  SolicitacaoAssinaturaEmailParams,
  StatusAssinaturaEmailParams,
  OtpAssinaturaEmailParams,
} from '../../domain/ports/IEmailService';
```

Adicionar o método ao final da classe:

```typescript
  async enviarNovoDocumentoContador(params: NovoDocumentoContadorEmailParams): Promise<void> {
    await this.enviar({
      destinatario: params.emailContador,
      assunto:      `Novo documento recebido de ${params.nomeCliente}`,
      corpoHtml:    `<p>Olá, ${params.nomeContador}! ${params.nomeCliente} enviou: <strong>${params.nomeArquivo}</strong> (${params.setor}). <a href="${params.urlPortal}/kanban">Ver no painel</a></p>`,
      corpoTexto:   `${params.nomeCliente} enviou "${params.nomeArquivo}" (${params.setor}). Acesse: ${params.urlPortal}/kanban`,
    });
    this.logger.debug('[ConsoleEmailAdapter] novoDocumentoContador', { destinatario: params.emailContador });
  }
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ports/IEmailService.ts src/infrastructure/email/ResendEmailAdapter.ts src/infrastructure/email/ConsoleEmailAdapter.ts
git commit -m "feat: adicionar enviarNovoDocumentoContador à interface e implementações de email"
```

---

## Task 3: Refatorar `verificarLembretesJob` para usar `emailService`

**Files:**
- Modify: `src/infrastructure/queue/jobs/verificarLembretesJob.ts`
- Modify: `src/infrastructure/queue/BullMQAdapter.ts`

- [ ] **Step 1: Atualizar `verificarLembretesJob.ts`**

Substituir o conteúdo completo do arquivo:

```typescript
import { prisma } from '@/infrastructure/di/Container';
import { lembreteObrigacaoHtml } from '@/infrastructure/email/templates/lembreteObrigacao';
import type { IEmailService } from '@/domain/ports/IEmailService';

export async function verificarLembretesJob(emailService: IEmailService): Promise<void> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 7);

  const instancias = await prisma.instanciaObrigacao.findMany({
    where: {
      concluida:       false,
      lembreteEnviado: false,
      vencimento:      { gte: hoje, lte: limite },
    },
    include: {
      obrigacao: {
        select: {
          nome:                true,
          lembreteAntecedencia: true,
          lembreteEmail:        true,
          lembreteNotificacao:  true,
        },
      },
      contador: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  for (const instancia of instancias) {
    const msRestantes   = instancia.vencimento.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(msRestantes / (1000 * 60 * 60 * 24));

    if (diasRestantes > instancia.obrigacao.lembreteAntecedencia) continue;

    const vencimentoStr = instancia.vencimento.toLocaleDateString('pt-BR');

    if (instancia.obrigacao.lembreteEmail && instancia.contador.email) {
      await emailService.enviar({
        destinatario: instancia.contador.email,
        assunto:      `Lembrete: ${instancia.obrigacao.nome} vence em ${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}`,
        corpoHtml:    lembreteObrigacaoHtml({
          nomeContador:  instancia.contador.name,
          nomeObrigacao: instancia.obrigacao.nome,
          vencimento:    vencimentoStr,
          diasRestantes,
          appUrl:        process.env.NEXT_PUBLIC_APP_URL ?? '',
        }),
        corpoTexto: `Olá ${instancia.contador.name}, a obrigação "${instancia.obrigacao.nome}" vence em ${vencimentoStr} (${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}).`,
      });
    }

    if (instancia.obrigacao.lembreteNotificacao) {
      await prisma.notificacao.create({
        data: {
          userId:    instancia.contadorId,
          userType:  'CONTADOR',
          tipo:      'LEMBRETE_OBRIGACAO',
          titulo:    `Obrigação vence em ${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}`,
          mensagem:  `${instancia.obrigacao.nome} vence em ${vencimentoStr}`,
          metadados: { instanciaId: instancia.id, vencimento: instancia.vencimento },
        },
      });
    }

    await prisma.instanciaObrigacao.update({
      where: { id: instancia.id },
      data:  { lembreteEnviado: true },
    });
  }
}
```

- [ ] **Step 2: Atualizar chamada em `BullMQAdapter.ts`**

Localizar a linha:
```typescript
if (job.name === 'verificar-lembretes') {
  await verificarLembretesJob();
  return;
}
```

Substituir por:
```typescript
if (job.name === 'verificar-lembretes') {
  await verificarLembretesJob(this.emailService);
  return;
}
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/queue/jobs/verificarLembretesJob.ts src/infrastructure/queue/BullMQAdapter.ts
git commit -m "refactor: verificarLembretesJob usa emailService injetado em vez de Resend direto"
```

---

## Task 4: Corrigir `processarLembreteBoleto` no BullMQAdapter

**Files:**
- Modify: `src/infrastructure/queue/BullMQAdapter.ts` — método `processarLembreteBoleto()`

- [ ] **Step 1: Substituir o método `processarLembreteBoleto`**

Localizar o método completo (começa em `private async processarLembreteBoleto(): Promise<void>`) e substituir pelo seguinte:

```typescript
  private async processarLembreteBoleto(): Promise<void> {
    if (!this.prisma || !this.emailService) {
      this.logger.warn('[BullMQAdapter] prisma/emailService não injetados — lembrete ignorado.');
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const em3Dias = new Date(hoje);
    em3Dias.setDate(em3Dias.getDate() + 3);
    em3Dias.setHours(23, 59, 59, 999);

    const boletos = await this.prisma.boletoHonorario.findMany({
      where: {
        status:          'PENDENTE',
        lembreteEnviado: false,
        vencimento:      { gte: hoje, lte: em3Dias },
        cliente:         { notifEmailBoleto: true },
      },
      select: {
        id:            true,
        valor:         true,
        vencimento:    true,
        mesReferencia: true,
        cliente:       { select: { email: true, name: true } },
        escritorio:    { select: { name: true } },
      },
    });

    this.logger.info('[BullMQAdapter] Lembretes de boleto a enviar.', { total: boletos.length });

    for (const boleto of boletos) {
      const vencimentoFmt = new Date(boleto.vencimento).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
      });
      const valorFmt = Number(boleto.valor).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL',
      });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

      const html = emailWrapper(`
        ${emailSubheading('Lembrete de Vencimento')}
        ${emailHeading('Seu boleto vence em breve')}
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px 0">
          Olá, <strong>${boleto.cliente.name}</strong>! Este é um lembrete de que você tem um boleto de honorários contábeis com vencimento em <strong>${vencimentoFmt}</strong>.
        </p>
        ${emailWarningCallout(`Este boleto vence em <strong>${vencimentoFmt}</strong>. Efetue o pagamento para evitar encargos por atraso.`)}
        ${emailInfoBox([
          { label: 'Escritório', value: boleto.escritorio.name },
          { label: 'Referência', value: boleto.mesReferencia },
          { label: 'Valor',      value: valorFmt },
          { label: 'Vencimento', value: vencimentoFmt },
        ])}
        ${emailCallout('Acesse o portal para visualizar e baixar o boleto.', 'ℹ️')}
        <div style="text-align:center;margin:32px 0">
          ${emailButton('Acessar Portal', `${appUrl}/cliente/financeiro`)}
        </div>
      `);

      try {
        await this.emailService.enviar({
          destinatario: boleto.cliente.email,
          assunto:      `[Lembrete] Boleto de ${valorFmt} vence em ${vencimentoFmt}`,
          corpoHtml:    html,
          corpoTexto:   `Olá ${boleto.cliente.name}, seu boleto de ${valorFmt} vence em ${vencimentoFmt}. Acesse: ${appUrl}/cliente/financeiro`,
        });

        await this.prisma.boletoHonorario.update({
          where: { id: boleto.id },
          data:  { lembreteEnviado: true },
        });

        this.logger.info('[BullMQAdapter] Lembrete de boleto enviado.', {
          clienteEmail: boleto.cliente.email,
          boletoId:     boleto.id,
        });
      } catch (err) {
        this.logger.error('[BullMQAdapter] Falha ao enviar lembrete de boleto.', {
          boletoId: boleto.id,
          message:  err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/queue/BullMQAdapter.ts
git commit -m "fix: corrigir processarLembreteBoleto para checar preferência e evitar reenvio duplicado"
```

---

## Task 5: Disparar email ao cliente na rota de lote do contador

**Files:**
- Modify: `app/api/v1/documentos/lote/route.ts`

- [ ] **Step 1: Adicionar import do `emailService`**

Localizar as linhas de import do Container:

```typescript
import { processarUploadLoteUseCase } from '../../../../../src/infrastructure/di/Container';
import { prisma }                     from '../../../../../src/infrastructure/di/Container';
import { queueProducer }              from '../../../../../src/infrastructure/di/Container';
```

Adicionar `emailService`:

```typescript
import { processarUploadLoteUseCase } from '../../../../../src/infrastructure/di/Container';
import { prisma }                     from '../../../../../src/infrastructure/di/Container';
import { queueProducer }              from '../../../../../src/infrastructure/di/Container';
import { emailService }               from '../../../../../src/infrastructure/di/Container';
```

- [ ] **Step 2: Expandir query de IDOR para incluir dados do cliente**

Localizar:

```typescript
  const vinculo = await prisma.contadorCliente.findUnique({
    where: {
      contadorId_clienteId: {
        contadorId,
        clienteId: parseResult.dto.clienteId,
      },
    },
    select: { clienteId: true },
  });
```

Substituir por:

```typescript
  const vinculo = await prisma.contadorCliente.findUnique({
    where: {
      contadorId_clienteId: {
        contadorId,
        clienteId: parseResult.dto.clienteId,
      },
    },
    include: {
      cliente: { select: { email: true, name: true, notifEmailNovoDoc: true } },
    },
  });
```

- [ ] **Step 3: Adicionar email fire-and-forget após upload bem-sucedido**

Localizar o bloco de criação de versões (fire-and-forget):

```typescript
  // Create version 1 for each newly uploaded document (fire-and-forget)
  if (output.uploadados.length > 0) {
    prisma.documentoVersao.createMany({
      ...
    }).catch(() => {/* non-critical */});
  }
```

Adicionar o bloco de email **logo após** esse bloco:

```typescript
  // Fire-and-forget: notificar cliente por email para cada documento enviado
  if (output.uploadados.length > 0 && vinculo.cliente.notifEmailNovoDoc) {
    for (const uploadado of output.uploadados) {
      emailService
        .enviarNovoDocumentoDisponivel({
          emailCliente: vinculo.cliente.email,
          nomeCliente:  vinculo.cliente.name,
          nomeArquivo:  uploadado.fileName,
          setor:        parseResult.dto.sector,
          urlPortal:    process.env.NEXT_PUBLIC_APP_URL ?? '',
        })
        .catch((err) => logger.error('[lote] falha ao enviar email novo doc', err instanceof Error ? err : undefined));
    }
  }
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/documentos/lote/route.ts
git commit -m "feat: notificar cliente por email ao receber documento do contador (lote)"
```

---

## Task 6: Melhorar email na rota de upload do cliente

**Files:**
- Modify: `app/api/v1/documentos/cliente-upload/route.ts`

- [ ] **Step 1: Expandir query do vínculo para incluir preferência do contador**

Localizar (passo 5 da rota, linha ~142):

```typescript
    const vinculo = await prisma.contadorCliente.findFirst({
      where: { clienteId: auth.sub },
      select: { contadorId: true },
    });
```

Substituir por:

```typescript
    const vinculo = await prisma.contadorCliente.findFirst({
      where:   { clienteId: auth.sub },
      include: {
        contador: { select: { id: true, email: true, name: true, notifEmailNovoDoc: true } },
      },
    });
```

- [ ] **Step 2: Atualizar referência a `vinculo.contadorId` na criação da tarefa**

Localizar `assignedTo: vinculo?.contadorId ?? null` e substituir por:

```typescript
          assignedTo:   vinculo?.contador?.id ?? null,
```

- [ ] **Step 3: Substituir o passo 7 (email fire-and-forget) pela versão correta**

Localizar o bloco inteiro (linhas ~206–221):

```typescript
    // ------------------------------------------------------------------
    // 7. Notifica o contador por e-mail (fire-and-forget)
    // ------------------------------------------------------------------
    if (vinculo?.contadorId) {
      prisma.usuarioContador.findUnique({
        where:  { id: vinculo.contadorId },
        select: { email: true, name: true },
      }).then((contador) => {
        if (!contador) return;
        const nomeCliente = auth.nome ?? 'Um cliente';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
        return emailService.enviar({
          destinatario: contador.email,
          assunto:      `Novo documento recebido: ${arquivo.name}`,
          corpoHtml:    `<p>Olá, <strong>${contador.name}</strong>.</p><p><strong>${nomeCliente}</strong> enviou um novo documento para análise: <strong>${arquivo.name}</strong>.</p><p><a href="${appUrl}/kanban">Acesse o painel</a> para categorizar e processar o arquivo.</p>`,
          corpoTexto:   `${nomeCliente} enviou um novo documento: ${arquivo.name}. Acesse ${appUrl}/kanban para processar.`,
        });
      }).catch(() => {});
    }
```

Substituir por:

```typescript
    // ------------------------------------------------------------------
    // 7. Notifica o contador por e-mail (fire-and-forget)
    // ------------------------------------------------------------------
    if (vinculo?.contador?.notifEmailNovoDoc) {
      const nomeCliente = auth.nome ?? 'Um cliente';
      emailService
        .enviarNovoDocumentoContador({
          emailContador: vinculo.contador.email,
          nomeContador:  vinculo.contador.name,
          nomeCliente,
          nomeArquivo:   arquivo.name,
          setor:         sector ?? 'A categorizar',
          urlPortal:     process.env.NEXT_PUBLIC_APP_URL ?? '',
        })
        .catch((err) => logger.error('[cliente-upload] falha ao enviar email', err instanceof Error ? err : undefined));
    }
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/documentos/cliente-upload/route.ts
git commit -m "feat: melhorar notificação de email ao contador no upload do cliente com preferência"
```

---

## Task 7: Endpoint de preferências de notificação

**Files:**
- Create: `app/api/v1/auth/preferencias-notificacao/route.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
import { NextResponse }                from 'next/server';
import { withAuth }                    from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { prisma }                      from '../../../../../src/infrastructure/di/Container';
import { logger }                      from '../../../../../src/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/auth/preferencias-notificacao
// Retorna as preferências de notificação do usuário autenticado.
// =============================================================================

export const GET = withAuth(async (_req, _ctx, auth) => {
  try {
    if (auth.role === 'ACCOUNTANT' || auth.role === 'ADMIN') {
      const contador = await prisma.usuarioContador.findUnique({
        where:  { id: auth.sub },
        select: { notifEmailNovoDoc: true },
      });
      if (!contador) return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
      return NextResponse.json({ notifEmailNovoDoc: contador.notifEmailNovoDoc });
    }

    if (auth.role === 'CLIENT') {
      const cliente = await prisma.usuarioCliente.findUnique({
        where:  { id: auth.sub },
        select: { notifEmailNovoDoc: true, notifEmailBoleto: true },
      });
      if (!cliente) return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
      return NextResponse.json({
        notifEmailNovoDoc: cliente.notifEmailNovoDoc,
        notifEmailBoleto:  cliente.notifEmailBoleto,
      });
    }

    return NextResponse.json({ message: 'Role não suportada.' }, { status: 403 });
  } catch (err) {
    logger.error('[GET /preferencias-notificacao] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);

// =============================================================================
// PATCH /api/v1/auth/preferencias-notificacao
// Atualiza as preferências de notificação do usuário autenticado.
//
// Body (todos opcionais, pelo menos um obrigatório):
//   notifEmailNovoDoc?: boolean  — Contador e Cliente
//   notifEmailBoleto?:  boolean  — Somente Cliente
// =============================================================================

export const PATCH = withAuth(async (req, _ctx, auth) => {
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: 'JSON inválido.' }, { status: 400 });
    }

    const { notifEmailNovoDoc, notifEmailBoleto } = body as {
      notifEmailNovoDoc?: unknown;
      notifEmailBoleto?:  unknown;
    };

    if (notifEmailNovoDoc !== undefined && typeof notifEmailNovoDoc !== 'boolean') {
      return NextResponse.json({ message: 'notifEmailNovoDoc deve ser boolean.' }, { status: 400 });
    }
    if (notifEmailBoleto !== undefined && typeof notifEmailBoleto !== 'boolean') {
      return NextResponse.json({ message: 'notifEmailBoleto deve ser boolean.' }, { status: 400 });
    }

    if (notifEmailNovoDoc === undefined && notifEmailBoleto === undefined) {
      return NextResponse.json({ message: 'Nenhum campo para atualizar.' }, { status: 400 });
    }

    if (auth.role === 'ACCOUNTANT' || auth.role === 'ADMIN') {
      if (notifEmailBoleto !== undefined) {
        return NextResponse.json({ message: 'notifEmailBoleto não se aplica ao contador.' }, { status: 400 });
      }
      const data: Record<string, boolean> = {};
      if (notifEmailNovoDoc !== undefined) data.notifEmailNovoDoc = notifEmailNovoDoc;

      await prisma.usuarioContador.update({ where: { id: auth.sub }, data });
      return NextResponse.json({ message: 'Preferências atualizadas.', ...data });
    }

    if (auth.role === 'CLIENT') {
      const data: Record<string, boolean> = {};
      if (notifEmailNovoDoc !== undefined) data.notifEmailNovoDoc = notifEmailNovoDoc;
      if (notifEmailBoleto  !== undefined) data.notifEmailBoleto  = notifEmailBoleto;

      await prisma.usuarioCliente.update({ where: { id: auth.sub }, data });
      return NextResponse.json({ message: 'Preferências atualizadas.', ...data });
    }

    return NextResponse.json({ message: 'Role não suportada.' }, { status: 403 });
  } catch (err) {
    logger.error('[PATCH /preferencias-notificacao] Erro', err instanceof Error ? err : undefined);
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });
  }
}, ['ACCOUNTANT', 'CLIENT', 'ADMIN']);
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/auth/preferencias-notificacao/route.ts
git commit -m "feat: endpoint GET/PATCH /api/v1/auth/preferencias-notificacao"
```

---

## Task 8: Tab de Notificações na página de configurações do contador

**Files:**
- Modify: `app/(contador)/configuracoes/page.tsx`

- [ ] **Step 1: Adicionar `Bell` ao import de lucide-react**

Localizar a linha de imports do lucide-react e adicionar `Bell`:

```typescript
import {
  User,
  Shield,
  Building2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  Download,
  LogIn,
  LogOut as LogOutIcon,
  FileText,
  UserX,
  Activity,
  Palette,
  Upload,
  Image as ImageIcon,
  CreditCard,
  XCircle,
  Check,
  Lock,
  Plug,
  KeyRound,
  Bell,
} from 'lucide-react';
```

- [ ] **Step 2: Adicionar `'notificacoes'` ao tipo `Aba`**

Localizar:
```typescript
type Aba = 'perfil' | 'seguranca' | 'escritorio' | 'white-label' | 'privacidade' | 'assinatura' | 'integracoes';
```

Substituir por:
```typescript
type Aba = 'perfil' | 'seguranca' | 'escritorio' | 'white-label' | 'privacidade' | 'assinatura' | 'integracoes' | 'notificacoes';
```

- [ ] **Step 3: Adicionar a aba ao array `ABAS`**

Localizar o array `ABAS` e adicionar o item notificações ao final:

```typescript
const ABAS: { id: Aba; label: string; icon: React.ReactNode }[] = [
  { id: 'perfil',         label: 'Perfil',         icon: <User        size={18} /> },
  { id: 'seguranca',      label: 'Segurança',      icon: <Shield      size={18} /> },
  { id: 'escritorio',     label: 'Escritório',     icon: <Building2   size={18} /> },
  { id: 'white-label',    label: 'White Label',    icon: <Palette     size={18} /> },
  { id: 'privacidade',    label: 'Privacidade',    icon: <ShieldCheck size={18} /> },
  { id: 'assinatura',     label: 'Assinatura',     icon: <CreditCard  size={18} /> },
  { id: 'integracoes',    label: 'Integrações',    icon: <Plug        size={18} /> },
  { id: 'notificacoes',   label: 'Notificações',   icon: <Bell        size={18} /> },
];
```

- [ ] **Step 4: Adicionar o componente `NotificacoesTab` ao final do arquivo**

Antes do fechamento final do arquivo (antes do último `}`), adicionar o componente:

```typescript
// =============================================================================
// Tab: Notificações
// =============================================================================

function NotificacoesTab({ token }: { token: string | null }) {
  const [notifEmailNovoDoc, setNotifEmailNovoDoc] = useState<boolean | null>(null);
  const [carregando, setCarregando]               = useState(true);
  const [salvando, setSalvando]                   = useState(false);
  const [toastLocal, setToastLocal]               = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/auth/preferencias-notificacao', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setNotifEmailNovoDoc(d.notifEmailNovoDoc ?? true))
      .catch(() => setNotifEmailNovoDoc(true))
      .finally(() => setCarregando(false));
  }, [token]);

  const alternar = async (novoValor: boolean) => {
    if (!token || salvando) return;
    setSalvando(true);
    setNotifEmailNovoDoc(novoValor);
    try {
      const res = await fetch('/api/v1/auth/preferencias-notificacao', {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notifEmailNovoDoc: novoValor }),
      });
      if (!res.ok) throw new Error();
      setToastLocal({ tipo: 'sucesso', msg: 'Preferência salva.' });
    } catch {
      setNotifEmailNovoDoc(!novoValor);
      setToastLocal({ tipo: 'erro', msg: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setSalvando(false);
      setTimeout(() => setToastLocal(null), 3000);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notificações por e-mail</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Escolha quais eventos geram um e-mail para você.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Cliente enviou um documento
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Receber e-mail quando um cliente fizer upload de arquivo.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notifEmailNovoDoc ?? true}
            aria-label="Receber e-mail quando cliente enviar documento"
            disabled={salvando}
            onClick={() => alternar(!(notifEmailNovoDoc ?? true))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50
              ${(notifEmailNovoDoc ?? true) ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                ${(notifEmailNovoDoc ?? true) ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </div>

      {toastLocal && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
          ${toastLocal.tipo === 'sucesso'
            ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
          }`}>
          {toastLocal.msg}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Renderizar a nova aba no bloco de conteúdo**

No bloco de conteúdo das abas (dentro do `<>` após o `carregandoDados ? ... :`), adicionar antes do fechamento `</>`:

```tsx
          {abaAtiva === 'notificacoes' && (
            <NotificacoesTab token={token} />
          )}
```

- [ ] **Step 6: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add app/\(contador\)/configuracoes/page.tsx
git commit -m "feat: adicionar tab de notificações por email nas configurações do contador"
```

---

## Task 9: Página de configurações do cliente + link no layout

**Files:**
- Create: `app/(cliente)/configuracoes/page.tsx`
- Modify: `app/(cliente)/layout.tsx`

- [ ] **Step 1: Criar `app/(cliente)/configuracoes/page.tsx`**

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../../src/presentation/hooks/useAuth';

// =============================================================================
// Página: /(cliente)/configuracoes — Preferências do Portal do Cliente
// =============================================================================

interface Preferencias {
  notifEmailNovoDoc: boolean;
  notifEmailBoleto:  boolean;
}

interface ToggleRowProps {
  label:     string;
  descricao: string;
  valor:     boolean;
  salvando:  boolean;
  onChange:  (v: boolean) => void;
}

function ToggleRow({ label, descricao, valor, salvando, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{descricao}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={valor}
        aria-label={label}
        disabled={salvando}
        onClick={() => onChange(!valor)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
          disabled:opacity-50
          ${valor ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
            ${valor ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}

export default function ClienteConfiguracoesPage() {
  const { token } = useAuth();

  const [prefs, setPrefs]         = useState<Preferencias | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando]   = useState(false);
  const [toast, setToast]         = useState<{ tipo: 'sucesso' | 'erro'; msg: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/auth/preferencias-notificacao', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setPrefs({
        notifEmailNovoDoc: d.notifEmailNovoDoc ?? true,
        notifEmailBoleto:  d.notifEmailBoleto  ?? true,
      }))
      .catch(() => setPrefs({ notifEmailNovoDoc: true, notifEmailBoleto: true }))
      .finally(() => setCarregando(false));
  }, [token]);

  const mostrarToast = (tipo: 'sucesso' | 'erro', msg: string) => {
    setToast({ tipo, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const salvar = async (campo: keyof Preferencias, valor: boolean) => {
    if (!token || salvando || !prefs) return;
    const anterior = prefs[campo];
    setSalvando(true);
    setPrefs({ ...prefs, [campo]: valor });
    try {
      const res = await fetch('/api/v1/auth/preferencias-notificacao', {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [campo]: valor }),
      });
      if (!res.ok) throw new Error();
      mostrarToast('sucesso', 'Preferência salva.');
    } catch {
      setPrefs({ ...prefs, [campo]: anterior });
      mostrarToast('erro', 'Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gerencie suas preferências de notificação.
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : prefs ? (
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Notificações por e-mail
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            <ToggleRow
              label="Novo documento disponível"
              descricao="Receber e-mail quando seu contador enviar um documento."
              valor={prefs.notifEmailNovoDoc}
              salvando={salvando}
              onChange={(v) => salvar('notifEmailNovoDoc', v)}
            />
            <ToggleRow
              label="Lembrete de boleto"
              descricao="Receber e-mail quando um boleto estiver próximo do vencimento."
              valor={prefs.notifEmailBoleto}
              salvando={salvando}
              onChange={(v) => salvar('notifEmailBoleto', v)}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-500">Não foi possível carregar as preferências.</p>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
          ${toast.tipo === 'sucesso'
            ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
            : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
          }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar "Configurações" ao `NAV_GROUPS` em `app/(cliente)/layout.tsx`**

Adicionar `Settings` ao import do lucide-react:

```typescript
import {
  FileText,
  Upload,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Loader2,
  Bell,
  ChevronDown,
  Building2,
  MessageSquare,
  DollarSign,
  Home,
  Clock,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronsRight,
  Users,
  PenLine,
  Settings,
} from 'lucide-react';
```

Localizar o grupo `'Suporte'` no `NAV_GROUPS` e adicionar um novo grupo antes dele:

```typescript
  {
    label: 'Conta',
    items: [
      { href: '/configuracoes', label: 'Configurações', icon: <Settings size={18} /> },
    ],
  },
  {
    label: 'Suporte',
    items: [
      { href: '/ajuda', label: 'Ajuda', icon: <HelpCircle size={18} /> },
    ],
  },
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 4: Commit final**

```bash
git add app/\(cliente\)/configuracoes/page.tsx app/\(cliente\)/layout.tsx
git commit -m "feat: página de configurações do cliente com preferências de email e link no menu"
```

---

## Verificação end-to-end

Após implementar todas as tasks:

```bash
# 1. Build de produção sem erros
npm run build

# 2. Servidor em desenvolvimento
npm run dev
```

**Cenário A — Contador faz upload:**
1. Login como contador → ir para `/lote`
2. Selecionar um cliente + setor + arquivo → enviar
3. Verificar log do servidor: `[lote] falha ao enviar email novo doc` NÃO deve aparecer
4. Se `RESEND_API_KEY` não estiver setado: `[ConsoleEmailAdapter]` deve aparecer no log

**Cenário B — Cliente faz upload:**
1. Login como cliente → ir para `/enviar`
2. Enviar um arquivo
3. Verificar log: sem erros, `[ConsoleEmailAdapter] novoDocumentoContador` deve aparecer

**Cenário C — Preferências do contador:**
1. Login como contador → `/configuracoes` → aba "Notificações"
2. Toggle desativar → verificar que persiste após reload

**Cenário D — Preferências do cliente:**
1. Login como cliente → `/configuracoes`
2. Dois toggles visíveis e funcionando
