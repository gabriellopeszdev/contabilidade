# Notificações por E-mail — Design Spec

> **Para workers agênticos:** SUB-SKILL OBRIGATÓRIA: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa.

**Goal:** Disparar emails automáticos quando um documento é enviado e corrigir o lembrete de boleto para respeitar preferências do usuário e evitar duplicatas.

**Architecture:** Campos booleanos de preferência direto nas tabelas de usuário, disparo fire-and-forget nas rotas de upload, e correção do job BullMQ de boleto para checar preferência e marcar `lembrete_enviado`.

**Tech Stack:** Prisma (migration), TypeScript, Resend via `IEmailService`, BullMQ, Next.js App Router API routes, React (settings UI).

---

## Contexto de infraestrutura existente

### O que já existe e NÃO muda
- `IEmailService` com `enviarNovoDocumentoDisponivel()` (cliente recebe quando contador envia)
- `ResendEmailAdapter` implementando todos os métodos de email existentes
- `emailTemplate.ts` com helpers `emailWrapper`, `emailButton`, `emailHeading`, etc.
- `processarLembreteBoleto()` no BullMQAdapter — job diário às 08:00 (corrigiremos)
- `verificarLembretesJob` — lembretes de obrigações — `lembreteEmail` por obrigação já funciona
- `PATCH /api/v1/auth/update-profile` — já aceita campos de perfil do usuário

### O que está quebrado
- `enviarNovoDocumentoDisponivel()` nunca é chamado nas rotas de upload
- `processarLembreteBoleto()` envia até 3 emails para o mesmo boleto (sem flag `lembrete_enviado`)
- `verificarLembretesJob` usa `Resend` diretamente em vez do `emailService` injetado

---

## Seção 1 — Schema (Prisma)

### Migration única com 4 novos campos

**`UsuarioContador`** — recebe email quando cliente sobe documento:
```prisma
notif_email_novo_doc  Boolean  @default(true) @map("notif_email_novo_doc")
```

**`UsuarioCliente`** — recebe email quando contador sobe documento; e lembrete de boleto:
```prisma
notif_email_novo_doc  Boolean  @default(true) @map("notif_email_novo_doc")
notif_email_boleto    Boolean  @default(true) @map("notif_email_boleto")
```

**`BoletoHonorario`** — previne reenvio do lembrete nos 3 dias antes do vencimento:
```prisma
lembrete_enviado  Boolean  @default(false) @map("lembrete_enviado")
```

### Campos NÃO adicionados
- `ObrigacaoFiscal.lembreteEmail` já existe — não muda
- Não criar tabela separada de preferências (YAGNI para o escopo atual)

---

## Seção 2 — Camada de email

### 2.1 `src/domain/ports/IEmailService.ts`

Adicionar interface e método:

```typescript
export interface NovoDocumentoContadorEmailParams {
  emailContador: string;
  nomeContador:  string;
  nomeCliente:   string;
  nomeArquivo:   string;
  setor:         string;
  urlPortal:     string;
}

// Na interface IEmailService:
enviarNovoDocumentoContador(params: NovoDocumentoContadorEmailParams): Promise<void>;
```

### 2.2 `src/infrastructure/email/ResendEmailAdapter.ts`

Implementar o novo método usando os helpers de template existentes:

```typescript
async enviarNovoDocumentoContador(params: NovoDocumentoContadorEmailParams): Promise<void> {
  const html = emailWrapper(`
    ${emailSubheading('Novo Documento Recebido')}
    ${emailHeading(`${params.nomeCliente} enviou um documento`)}
    ${emailText(`O cliente <strong>${params.nomeCliente}</strong> enviou um novo documento para sua análise.`)}
    ${emailInfoBox([
      ['Arquivo', params.nomeArquivo],
      ['Setor',   params.setor],
    ])}
    <div style="text-align:center;margin:32px 0">
      ${emailButton('Ver Documento', `${params.urlPortal}/contador/clientes`)}
    </div>
  `);

  await this.enviar({
    destinatario: params.emailContador,
    assunto:      `Novo documento de ${params.nomeCliente}`,
    corpoHtml:    html,
    corpoTexto:   `${params.nomeCliente} enviou o arquivo "${params.nomeArquivo}" (${params.setor}). Acesse: ${params.urlPortal}`,
  });
}
```

### 2.3 `src/infrastructure/email/ConsoleEmailAdapter.ts`

Adicionar stub do novo método (log no console, sem envio real):

```typescript
async enviarNovoDocumentoContador(params: NovoDocumentoContadorEmailParams): Promise<void> {
  this.logger.info('[ConsoleEmailAdapter] enviarNovoDocumentoContador', params);
}
```

### 2.4 `src/infrastructure/queue/jobs/verificarLembretesJob.ts`

Refatorar para usar `emailService` injetado em vez de chamar `Resend` diretamente:

```typescript
// ANTES (errado):
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({ ... });

// DEPOIS (correto):
// Recebe emailService como parâmetro da função
export async function verificarLembretesJob(emailService: IEmailService): Promise<void> {
  // ...
  await emailService.enviar({ destinatario, assunto, corpoHtml, corpoTexto });
}
```

Atualizar o BullMQAdapter para passar `this.emailService` ao chamar `verificarLembretesJob`.

---

## Seção 3 — Rotas de upload

### 3.1 `app/api/v1/documentos/lote/route.ts` (contador faz upload em lote)

Após salvar os documentos com sucesso, para cada documento enviado:

```typescript
// Fire-and-forget — não atrasa a resposta HTTP
if (cliente.notifEmailNovoDoc) {
  emailService
    .enviarNovoDocumentoDisponivel({
      emailCliente:  cliente.email,
      nomeCliente:   cliente.name,
      nomeArquivo:   documento.nomeArquivo,
      setor:         documento.setor,
      urlPortal:     process.env.NEXT_PUBLIC_APP_URL ?? '',
    })
    .catch((err) => logger.error('[lote] falha ao enviar email novo doc', err));
}
```

Buscar `cliente.notifEmailNovoDoc` junto com os dados do cliente na query existente (adicionar campo ao `select`).

### 3.2 `app/api/v1/documentos/cliente-upload/route.ts` (cliente faz upload)

Após salvar o documento, buscar o contador responsável pelo cliente via `ContadorCliente`:

```typescript
const vinculo = await prisma.contadorCliente.findFirst({
  where: { clienteId },
  include: { contador: { select: { email: true, name: true, notifEmailNovoDoc: true } } },
});

if (vinculo?.contador.notifEmailNovoDoc) {
  emailService
    .enviarNovoDocumentoContador({
      emailContador: vinculo.contador.email,
      nomeContador:  vinculo.contador.name,
      nomeCliente:   cliente.name,
      nomeArquivo:   documento.nomeArquivo,
      setor:         documento.setor,
      urlPortal:     process.env.NEXT_PUBLIC_APP_URL ?? '',
    })
    .catch((err) => logger.error('[cliente-upload] falha ao enviar email', err));
}
```

---

## Seção 4 — Correção do lembrete de boleto

### `src/infrastructure/queue/BullMQAdapter.ts` — `processarLembreteBoleto()`

**Problema atual:** query sem filtro `lembrete_enviado: false`, sem checar `cliente.notif_email_boleto`, e sem marcar `lembrete_enviado = true` após envio.

**Query corrigida:**
```typescript
const boletos = await this.prisma.boletoHonorario.findMany({
  where: {
    status:          'PENDENTE',
    lembreteEnviado: false,                    // novo: evita duplicatas
    vencimento:      { gte: hoje, lte: em3Dias },
    cliente: { notifEmailBoleto: true },       // novo: respeita preferência
  },
  select: {
    id:            true,
    valor:         true,
    vencimento:    true,
    mesReferencia: true,
    cliente: {
      select: {
        email:            true,
        name:             true,
        notifEmailBoleto: true,                // campo novo
      },
    },
    escritorio: { select: { name: true } },
  },
});
```

**Após envio bem-sucedido:**
```typescript
await this.prisma.boletoHonorario.update({
  where: { id: boleto.id },
  data:  { lembreteEnviado: true },
});
```

---

## Seção 5 — API de preferências

### 5.1 Novo endpoint `PATCH /api/v1/auth/preferencias-notificacao`

O endpoint `update-profile` existente só aceita campos de perfil e só serve o contador — não vamos tocá-lo.

Criar `app/api/v1/auth/preferencias-notificacao/route.ts`:

```typescript
// Aceita qualquer combinação dos campos abaixo
// Role lida do JWT determina qual tabela atualizar
export interface PreferenciasNotificacaoBody {
  notifEmailNovoDoc?: boolean;  // Contador e Cliente
  notifEmailBoleto?:  boolean;  // Somente Cliente
}
```

**Lógica:**
- Lê role do JWT (`ACCOUNTANT` / `CLIENT` / `ADMIN`)
- Valida que os campos enviados são booleanos
- Para `ACCOUNTANT`: atualiza `UsuarioContador` — aceita `notifEmailNovoDoc`
- Para `CLIENT`: atualiza `UsuarioCliente` — aceita `notifEmailNovoDoc` e `notifEmailBoleto`
- Retorna 200 com campos atualizados

---

## Seção 6 — UI de preferências

### 6.1 Página de configurações do Contador (`app/(contador)/configuracoes/page.tsx`)

Adicionar seção "Notificações por e-mail" (a página já existe, só adicionar a seção):

| Toggle | Campo | Default |
|--------|-------|---------|
| Avisar quando cliente enviar documento | `notifEmailNovoDoc` | ativado |

### 6.2 Nova página de configurações do Cliente (`app/(cliente)/configuracoes/page.tsx`)

O cliente não tem página de configurações — criar do zero seguindo o layout de `app/(cliente)/layout.tsx`.

Dois toggles:

| Toggle | Campo | Default |
|--------|-------|---------|
| Avisar quando contador enviar documento | `notifEmailNovoDoc` | ativado |
| Lembrete de boleto próximo ao vencimento | `notifEmailBoleto` | ativado |

Adicionar link "Configurações" no menu de navegação do layout cliente.

### Padrão de UI para cada toggle (reutilizar nos dois contextos)

```tsx
<div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
  <div>
    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
      {label}
    </p>
    <p className="text-xs text-slate-500 dark:text-slate-400">{descricao}</p>
  </div>
  <button
    role="switch"
    aria-checked={valor}
    aria-label={label}
    onClick={() => salvar(!valor)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
      ${valor ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
      ${valor ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
</div>
```

### Persistência

Cada toggle chama `PATCH /api/v1/auth/preferencias-notificacao` com o campo alterado (debounce opcional de 300ms). Mostrar `toast.success('Preferências salvas')` ou `toast.error(...)` conforme resultado.

---

## Fluxo completo por cenário

### Cenário A — Contador envia documento para cliente
1. `POST /api/v1/documentos/lote` salva documento
2. Busca `cliente.notifEmailNovoDoc`
3. Se `true` → `emailService.enviarNovoDocumentoDisponivel()` (fire-and-forget)
4. Cliente recebe email "Novo documento disponível"

### Cenário B — Cliente envia documento para o contador
1. `POST /api/v1/documentos/cliente-upload` salva documento
2. Busca contador via `ContadorCliente` + `contador.notifEmailNovoDoc`
3. Se `true` → `emailService.enviarNovoDocumentoContador()` (fire-and-forget)
4. Contador recebe email "Novo documento de [cliente]"

### Cenário C — Boleto vence em até 3 dias
1. Job diário às 08:00 busca boletos `PENDENTE`, `lembreteEnviado: false`, vencimento ≤ 3 dias
2. Para cada boleto, verifica `cliente.notifEmailBoleto`
3. Se `true` → envia email de lembrete
4. Marca `lembreteEnviado = true` → cliente recebe exatamente 1 email por boleto

### Cenário D — Obrigação fiscal vence em breve
- Já funciona via `verificarLembretesJob` + `ObrigacaoFiscal.lembreteEmail`
- Única mudança: refatorar para usar `emailService` em vez de `Resend` direto

---

## O que NÃO está no escopo

- Notificação quando boleto é pago (webhook Asaas já existe para isso)
- Digest diário / resumo semanal por email
- Preferências de notificações in-app (sistema de notificações já existe separado)
- Templates de email com logo personalizado do escritório
