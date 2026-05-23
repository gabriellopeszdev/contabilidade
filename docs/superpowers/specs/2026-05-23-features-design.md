# Design: Novas Features — Recuperação de Senha, Convite, Notificações, Export CSV

**Data:** 2026-05-23
**Status:** Aprovado

---

## Escopo

4 entregas independentes, na ordem de dependência:

1. Adaptador Resend (base para e-mail)
2. Recuperação de senha
3. Convite de cliente + reenvio
4. Notificações in-app (sino)
5. Export CSV (contador)

Features 4 (dashboard) e 6 (perfil) já estão implementadas. Feature 7 (onboarding) é coberta pelo item 3.

---

## 1. Adaptador Resend

### Objetivo
Substituir `ConsoleEmailAdapter` por envio real via Resend, mantendo fallback para dev.

### Mudanças

**`IEmailService`** — adicionar 2 métodos:
```ts
enviarRecuperacaoSenha(email: string, link: string): Promise<void>
enviarConviteCliente(email: string, nome: string, link: string): Promise<void>
```

**`ResendEmailAdapter`** — `src/infrastructure/email/ResendEmailAdapter.ts`
- Implementa `IEmailService` completo
- Usa SDK `resend` (instalar: `npm i resend`)
- Templates em HTML simples inline (sem engine de template)

**`Container.ts`**
- Injetar `ResendEmailAdapter` se `RESEND_API_KEY` presente no env
- Caso contrário mantém `ConsoleEmailAdapter` (dev sem chave continua funcionando)

**`.env`** — novas variáveis:
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@seudominio.com.br
```

---

## 2. Recuperação de Senha

### Objetivo
Fluxo seguro de reset de senha para contadores, sem revelar se o e-mail existe.

### Schema (migration Prisma)

Novos campos em `UsuarioContador`:
```prisma
resetToken           String?   @unique @map("reset_token")
resetTokenExpiresAt  DateTime? @map("reset_token_expires_at") @db.Timestamptz
```

### Rotas API

**`POST /api/v1/auth/forgot-password`**
- Body: `{ email: string }`
- Busca contador por e-mail; se não encontrar, retorna `200` mesmo assim
- Gera `crypto.randomUUID()` como token, salva o token diretamente no banco (consistente com o padrão `inviteToken`), expira em 2h
- Chama `emailService.enviarRecuperacaoSenha(email, link)`
- Link: `${NEXT_PUBLIC_APP_URL}/auth/recuperar-senha/${token}`
- Resposta: `200 { ok: true }` sempre

**`POST /api/v1/auth/reset-password`**
- Body: `{ token: string, novaSenha: string }`
- Valida: token existe, não expirado, senha ≥ 8 chars
- Faz bcrypt hash, salva nova senha, nula `resetToken` e `resetTokenExpiresAt`
- Retorna `200 { ok: true }` ou `422` com mensagem de erro

### Páginas

**`app/auth/recuperar-senha/page.tsx`**
- Campo e-mail + botão "Enviar link"
- Após submit: mensagem de sucesso genérica (independente de o e-mail existir)
- Link "Voltar para login"

**`app/auth/recuperar-senha/[token]/page.tsx`**
- Campos: nova senha + confirmar senha
- Valida match no front antes de submeter
- Após sucesso: redireciona para `/` com mensagem "Senha redefinida com sucesso"
- Se token inválido/expirado: mensagem de erro + link para solicitar novo

**`app/page.tsx`** — adicionar link "Esqueci minha senha" abaixo do formulário de login.

---

## 3. Convite de Cliente + Reenvio

### Objetivo
Enviar e-mail real ao criar cliente e permitir reenvio para contas não ativadas.

### Envio automático no cadastro

**`POST /api/v1/clientes`** (atualizar):
- Após `prisma.usuarioCliente.create(...)`, chamar `emailService.enviarConviteCliente(email, nome, link)`
- Link: `${NEXT_PUBLIC_APP_URL}/auth/ativar-conta?token=${inviteToken}`
- Falha de e-mail: apenas `logger.error(...)`, não reverte criação do cliente

### Reenvio de convite

**`POST /api/v1/clientes/[id]/reenviar-convite`** (novo):
- Verifica que `activatedAt === null` (conta não ativada)
- Gera novo `inviteToken` (UUID) e nova `inviteExpiresAt` (now + 48h)
- Salva no banco, envia e-mail
- Retorna `200 { ok: true }` ou `400` se conta já ativada

**UI em `/clientes`**:
- Coluna de status mostra badge "Pendente" para clientes com `activatedAt === null`
- Botão de ação "Reenviar convite" (ícone `Send`) na linha do cliente pendente
- Toast de confirmação após envio

---

## 4. Notificações In-App (Sino)

### Objetivo
Exibir eventos WebSocket em tempo real no header, sem persistência em banco.

### Componente `<SinoNotificacoes />`

**Local:** `src/presentation/components/SinoNotificacoes.tsx`

**Comportamento:**
- Ícone `Bell` (Lucide) no header do layout contador e do layout cliente
- Badge vermelho com contagem de não-lidas; some ao abrir o painel
- Dropdown: lista dos últimos 10 eventos da sessão (LIFO)
- Sem scroll infinito, sem "ver todas"
- Ao fechar, marca todas como lidas (badge zera)

**Hook `useNotificacoes`** — verificar/adaptar `src/presentation/hooks/useNotificacoes.ts`:
- Manter array `notificacoes[]` em `useState`
- Escutar eventos Socket.IO e fazer `prepend` ao array (limite 10)
- Expor `{ notificacoes, naoLidas, marcarComoLidas }`

**Eventos capturados e mensagens:**

| Evento Socket.IO | Mensagem exibida |
|---|---|
| `NovoBoletoHonorarioEvent` | "Novo boleto: R$ X" |
| `BoletoStatusAtualizadoEvent` | "Boleto atualizado: STATUS" |
| `NovoDocumentoUploadEvent` | "X documento(s) disponíveis" |

**Layouts a atualizar:**
- `app/(contador)/layout.tsx` — adicionar `<SinoNotificacoes />` no header
- `app/(cliente)/layout.tsx` — idem

---

## 5. Export CSV

### Objetivo
Download de listas em CSV direto do browser, server-side, sem biblioteca extra.

### Endpoints

**`GET /api/v1/clientes/export`**
- Auth: `withAuth(['ACCOUNTANT'])`
- Busca todos clientes do escritório (sem paginação)
- Colunas: `Nome,Email,CNPJ,Status,Ativado em,Criado em`
- Response: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="clientes.csv"`

**`GET /api/v1/financeiro/boletos/export`**
- Auth: `withAuth(['ACCOUNTANT'])`
- Busca todos boletos do escritório (sem paginação)
- Colunas: `Cliente,Referência,Valor,Status,Tipo,Vencimento,Criado em`
- Response: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="boletos.csv"`

### Geração CSV
Função utilitária `src/utils/csv.ts`:
```ts
function toCSV(headers: string[], rows: string[][]): string
```
Escapa campos com vírgulas/aspas seguindo RFC 4180.

### UI

**`/clientes`** — botão "Exportar CSV" (`Download` icon, variante `outline`) no canto superior direito da listagem.

**`/financeiro`** — botão "Exportar CSV" na aba de boletos, mesmo posicionamento.

**Download handler:**
```ts
const res = await fetch('/api/v1/clientes/export', { headers: { Authorization: `Bearer ${token}` } });
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'clientes.csv'; a.click();
URL.revokeObjectURL(url);
```

---

## Ordem de implementação

1. Resend adapter + env vars
2. Migration Prisma (campos reset token)
3. Recuperação de senha (API + páginas)
4. Convite de cliente (email no POST + reenvio)
5. Sino de notificações (componente + hook + layouts)
6. Export CSV (utilitário + endpoints + botões UI)

---

## Fora de escopo

- Notificações persistentes (sem tabela `Notificacao`)
- Reset de senha para clientes (usam fluxo de ativação)
- Export XLSX (CSV suficiente para o momento)
- Templates HTML elaborados para e-mails (HTML simples inline)
