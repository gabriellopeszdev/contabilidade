# Lembretes Automáticos + Obrigações Recorrentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Obrigações fiscais geram lembretes automáticos por email e notificação in-app X dias antes do vencimento; obrigações podem ter recorrência (mensal, trimestral, etc.) que as auto-gera no calendário.

**Architecture:** BullMQ job diário às 08:00 (já existe) verifica obrigações com vencimento em N dias e dispara emails/notificações. Um novo campo `recorrencia` na `ObrigacaoFiscal` permite definir padrão de repetição. Um job mensal cria as instâncias do mês seguinte a partir dos templates.

**Tech Stack:** BullMQ (já configurado), Resend (já configurado), Prisma, otplib não necessário.

---

## Arquivo Map

| Ação | Arquivo |
|------|---------|
| Modify | `prisma/schema.prisma` |
| Create | `src/infrastructure/queue/jobs/verificarLembretesJob.ts` |
| Create | `src/infrastructure/queue/jobs/gerarObrigacoesRecorrentesJob.ts` |
| Modify | `src/infrastructure/queue/BullMQAdapter.ts` |
| Create | `src/infrastructure/email/templates/lembreteObrigacao.ts` |
| Modify | `app/api/v1/calendario/obrigacoes/route.ts` |
| Modify | `app/api/v1/calendario/obrigacoes/[id]/route.ts` |

---

## Task 1: Schema — campos de recorrência e lembrete

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar enum e campos**

Adicionar enum antes dos models:

```prisma
enum RecorrenciaTipo {
  MENSAL
  BIMESTRAL
  TRIMESTRAL
  SEMESTRAL
  ANUAL
}
```

Dentro de `model ObrigacaoFiscal`, adicionar após `ativo Boolean`:

```prisma
  recorrencia          RecorrenciaTipo? // null = não recorrente
  lembreteAntecedencia Int              @default(3) @map("lembrete_antecedencia") // dias
  lembreteEmail        Boolean          @default(true) @map("lembrete_email")
  lembreteNotificacao  Boolean          @default(true) @map("lembrete_notificacao")
  // Para obrigações recorrentes: meses em que se aplica (1-12). Vazio = todos os meses.
  mesesAplicacao       Int[]            @map("meses_aplicacao")
  // Última vez que lembrete foi enviado para evitar duplicatas
  ultimoLembreteEm     DateTime?        @map("ultimo_lembrete_em") @db.Timestamptz
```

- [ ] **Step 2: Criar nova tabela InstanciaObrigacao**

Adicionar após o model `ObrigacaoFiscal`:

```prisma
// Instância mensal gerada a partir de uma ObrigacaoFiscal recorrente
model InstanciaObrigacao {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  obrigacaoId    String   @map("obrigacao_id") @db.Uuid
  contadorId     String   @map("contador_id") @db.Uuid
  mesReferencia  String   @map("mes_referencia") @db.VarChar(7) // "2026-06"
  vencimento     DateTime @db.Date
  concluida      Boolean  @default(false)
  concluidaEm    DateTime? @map("concluida_em") @db.Timestamptz
  lembreteEnviado Boolean @default(false) @map("lembrete_enviado")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  obrigacao ObrigacaoFiscal @relation(fields: [obrigacaoId], references: [id], onDelete: Cascade)
  contador  UsuarioContador @relation(fields: [contadorId], references: [id], onDelete: Cascade)

  @@unique([obrigacaoId, mesReferencia])
  @@index([contadorId, vencimento])
  @@index([vencimento, lembreteEnviado])
  @@map("instancia_obrigacao")
}
```

Adicionar relação em `ObrigacaoFiscal`:
```prisma
  instancias InstanciaObrigacao[]
```

E em `UsuarioContador`:
```prisma
  instanciasObrigacoes InstanciaObrigacao[]
```

- [ ] **Step 3: Migrar**

```bash
npx prisma migrate dev --name add_obrigacoes_recorrentes
```

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(obrigacoes): add recorrencia fields and InstanciaObrigacao table"
```

---

## Task 2: Template de email de lembrete

**Files:**
- Create: `src/infrastructure/email/templates/lembreteObrigacao.ts`

- [ ] **Step 1: Criar template**

```typescript
export interface LembreteObrigacaoData {
  nomeContador:  string;
  nomeObrigacao: string;
  vencimento:    string; // "15/06/2026"
  diasRestantes: number;
  appUrl:        string;
}

export function lembreteObrigacaoHtml(data: LembreteObrigacaoData): string {
  const urgencia = data.diasRestantes <= 1 ? '🚨 URGENTE' : data.diasRestantes <= 3 ? '⚠️ Atenção' : '📅 Lembrete';
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
    <div style="background:#2563eb;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">${urgencia} — Obrigação Fiscal</h1>
    </div>
    <div style="padding:24px">
      <p>Olá, <strong>${data.nomeContador}</strong>!</p>
      <p>A obrigação <strong>${data.nomeObrigacao}</strong> vence em <strong>${data.diasRestantes === 0 ? 'HOJE' : `${data.diasRestantes} dia(s)`}</strong>.</p>
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:16px;margin:16px 0;text-align:center">
        <p style="margin:0;font-size:18px;font-weight:bold;color:#92400e">Vencimento: ${data.vencimento}</p>
      </div>
      <div style="text-align:center;margin-top:24px">
        <a href="${data.appUrl}/calendario" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Ver Calendário</a>
      </div>
    </div>
    <div style="padding:16px;text-align:center;color:#6b7280;font-size:12px">
      <p>Konto Contábil · Você recebe este email pois tem lembretes ativados.</p>
    </div>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/email/templates/lembreteObrigacao.ts
git commit -m "feat(obrigacoes): add lembrete email template"
```

---

## Task 3: Job de verificação de lembretes

**Files:**
- Create: `src/infrastructure/queue/jobs/verificarLembretesJob.ts`

- [ ] **Step 1: Ler BullMQAdapter para entender padrão de jobs**

Leia `src/infrastructure/queue/BullMQAdapter.ts` para entender como jobs são registrados.

- [ ] **Step 2: Criar job**

```typescript
import { prisma } from '@/src/infrastructure/database/prisma';
import { lembreteObrigacaoHtml } from '@/src/infrastructure/email/templates/lembreteObrigacao';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function verificarLembretesJob(): Promise<void> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Buscar instâncias não concluídas com vencimento em até 7 dias
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 7);

  const instancias = await prisma.instanciaObrigacao.findMany({
    where: {
      concluida: false,
      lembreteEnviado: false,
      vencimento: { gte: hoje, lte: limite },
    },
    include: {
      obrigacao: {
        select: {
          nome: true,
          lembreteAntecedencia: true,
          lembreteEmail: true,
          lembreteNotificacao: true,
        },
      },
      contador: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  for (const instancia of instancias) {
    const msRestantes = instancia.vencimento.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(msRestantes / (1000 * 60 * 60 * 24));

    if (diasRestantes > instancia.obrigacao.lembreteAntecedencia) continue;

    const vencimentoStr = instancia.vencimento.toLocaleDateString('pt-BR');

    // Email
    if (instancia.obrigacao.lembreteEmail && instancia.contador.email) {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@konto.app',
        to: instancia.contador.email,
        subject: `Lembrete: ${instancia.obrigacao.nome} vence em ${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}`,
        html: lembreteObrigacaoHtml({
          nomeContador:  instancia.contador.name,
          nomeObrigacao: instancia.obrigacao.nome,
          vencimento:    vencimentoStr,
          diasRestantes,
          appUrl:        process.env.NEXT_PUBLIC_APP_URL ?? '',
        }),
      });
    }

    // Notificação in-app
    if (instancia.obrigacao.lembreteNotificacao) {
      await prisma.notificacao.create({
        data: {
          userId:   instancia.contadorId,
          userType: 'CONTADOR',
          tipo:     'LEMBRETE_OBRIGACAO',
          titulo:   `Obrigação vence em ${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}`,
          mensagem: `${instancia.obrigacao.nome} vence em ${vencimentoStr}`,
          metadados: { instanciaId: instancia.id, vencimento: instancia.vencimento },
        },
      });
    }

    // Marcar lembrete como enviado
    await prisma.instanciaObrigacao.update({
      where: { id: instancia.id },
      data: { lembreteEnviado: true },
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/queue/jobs/verificarLembretesJob.ts
git commit -m "feat(obrigacoes): add verificarLembretesJob (email + notificação in-app)"
```

---

## Task 4: Job de geração de instâncias recorrentes

**Files:**
- Create: `src/infrastructure/queue/jobs/gerarObrigacoesRecorrentesJob.ts`

- [ ] **Step 1: Criar job**

```typescript
import { prisma } from '@/src/infrastructure/database/prisma';

const MESES_POR_RECORRENCIA: Record<string, number[]> = {
  MENSAL:      [1,2,3,4,5,6,7,8,9,10,11,12],
  BIMESTRAL:   [1,3,5,7,9,11],
  TRIMESTRAL:  [1,4,7,10],
  SEMESTRAL:   [1,7],
  ANUAL:       [1],
};

export async function gerarObrigacoesRecorrentesJob(): Promise<void> {
  // Gera instâncias do próximo mês
  const agora = new Date();
  const proximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  const ano = proximoMes.getFullYear();
  const mes = proximoMes.getMonth() + 1; // 1-12
  const mesReferencia = `${ano}-${String(mes).padStart(2, '0')}`;

  const obrigacoes = await prisma.obrigacaoFiscal.findMany({
    where: { ativo: true, recorrencia: { not: null } },
  });

  for (const obrigacao of obrigacoes) {
    if (!obrigacao.recorrencia) continue;

    const mesesValidos = obrigacao.mesesAplicacao.length > 0
      ? obrigacao.mesesAplicacao
      : MESES_POR_RECORRENCIA[obrigacao.recorrencia] ?? [];

    if (!mesesValidos.includes(mes)) continue;

    // Calcular data de vencimento
    const diaVenc = Math.min(obrigacao.diaVencimento, new Date(ano, mes, 0).getDate());
    const vencimento = new Date(ano, mes - 1, diaVenc);

    // Criar instância se não existir (upsert via unique constraint)
    await prisma.instanciaObrigacao.upsert({
      where: { obrigacaoId_mesReferencia: { obrigacaoId: obrigacao.id, mesReferencia } },
      create: {
        obrigacaoId: obrigacao.id,
        contadorId:  obrigacao.contadorId,
        mesReferencia,
        vencimento,
      },
      update: {}, // não atualizar se já existe
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/queue/jobs/gerarObrigacoesRecorrentesJob.ts
git commit -m "feat(obrigacoes): add gerarObrigacoesRecorrentesJob"
```

---

## Task 5: Registrar jobs no BullMQ scheduler

**Files:**
- Modify: `src/infrastructure/queue/BullMQAdapter.ts`

- [ ] **Step 1: Adicionar jobs ao scheduler**

No `BullMQAdapter.ts`, na parte onde o job diário de 08:00 é agendado, adicionar:

```typescript
// Job diário 08:00 — lembretes de obrigações
await this.queue.add('verificar-lembretes', {}, {
  repeat: { pattern: '0 8 * * *' },
  jobId: 'verificar-lembretes',
});

// Job mensal no dia 25 às 09:00 — gerar instâncias do próximo mês
await this.queue.add('gerar-obrigacoes-recorrentes', {}, {
  repeat: { pattern: '0 9 25 * *' },
  jobId: 'gerar-obrigacoes-recorrentes',
});
```

No worker, adicionar os handlers:

```typescript
import { verificarLembretesJob } from './jobs/verificarLembretesJob';
import { gerarObrigacoesRecorrentesJob } from './jobs/gerarObrigacoesRecorrentesJob';

// Dentro do worker.process ou switch/case de jobs:
case 'verificar-lembretes':
  await verificarLembretesJob();
  break;
case 'gerar-obrigacoes-recorrentes':
  await gerarObrigacoesRecorrentesJob();
  break;
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/queue/BullMQAdapter.ts
git commit -m "feat(obrigacoes): register lembrete + recorrencia jobs in BullMQ scheduler"
```

---

## Task 6: Atualizar API do calendário

**Files:**
- Modify: `app/api/v1/calendario/obrigacoes/route.ts`
- Modify: `app/api/v1/calendario/obrigacoes/[id]/route.ts`

- [ ] **Step 1: Ler os arquivos atuais**

Leia ambos os arquivos para entender os campos atuais de entrada/saída.

- [ ] **Step 2: Atualizar POST/PUT para aceitar campos novos**

No body de criação/atualização, aceitar os novos campos:
- `recorrencia?: 'MENSAL' | 'BIMESTRAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | null`
- `lembreteAntecedencia?: number` (padrão 3)
- `lembreteEmail?: boolean`
- `lembreteNotificacao?: boolean`
- `mesesAplicacao?: number[]`

- [ ] **Step 3: Expor instâncias no GET do calendário**

No GET de eventos do calendário (`app/api/v1/calendario/eventos/route.ts`), incluir instâncias de obrigações recorrentes no mês solicitado.

- [ ] **Step 4: Rota para marcar instância como concluída**

Criar `app/api/v1/calendario/instancias/[id]/concluir/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';

export const POST = withAuth(async (req, { params }) => {
  const { id } = await params;

  await prisma.instanciaObrigacao.update({
    where: { id },
    data: { concluida: true, concluidaEm: new Date() },
  });

  return NextResponse.json({ message: 'Obrigação marcada como concluída' });
}, ['ACCOUNTANT', 'EMPLOYEE']);
```

- [ ] **Step 5: Commit**

```bash
git add app/api/v1/calendario/
git commit -m "feat(obrigacoes): update calendar API to support recorrencia and instancias"
```

---

## Verificação final

- [ ] Criar uma obrigação MENSAL → verificar que instância do próximo mês é gerada pelo job
- [ ] Simular job de lembretes com instância com vencimento em 2 dias → email enviado
- [ ] Marcar instância como concluída → lembrete não reenviado
- [ ] `npm run build` sem erros
