# Prompt para Claude Code — Substituir DocSeal/SignatureAPI por ZapSign

Contexto: o projeto FiscoHub (Next.js 16 + TypeScript + Prisma 7 + PostgreSQL, Clean Architecture com camadas domain/application/infrastructure/presentation) tem assinatura eletrônica de documentos com 3 providers possíveis, selecionados por cliente ou por escritório: INTERNO (fluxo próprio via token), DOCSEAL (self-hosted, container docseal no docker-compose) e SIGNATUREAPI (serviço externo pago). Nenhum dos dois está em uso real — DOCSEAL_API_KEY está vazia (já cai automático no fluxo INTERNO) e SIGNATUREAPI_API_KEY está preenchida mas não deve continuar sendo usada.

**TAREFA:** remover completamente DocSeal e SignatureAPI do projeto e substituir por um novo provider ZapSign (https://zapsign.com.br), mantendo o fluxo INTERNO como fallback igual já é hoje. Implementar de forma completa: criação de documento, consulta/detalhamento, exclusão, reenvio de notificação, e todos os eventos de webhook relevantes.

---

## Referência completa da API ZapSign

Base URL: `https://api.zapsign.com.br/api/v1`
Autenticação: header `Authorization: Bearer {API_TOKEN}` em toda requisição.
Ambiente de testes: `https://sandbox.app.zapsign.com.br` (usar um token de sandbox em dev/staging antes de ir pra produção, evita cobrança).

Convenções gerais da API: nunca enviar `null` em campos string (usar `""` ou omitir o campo); `true`/`false` são booleanos reais, não strings; datas/horas são armazenadas em UTC+0 no servidor da ZapSign.

### 1. Criar documento — `POST /docs/`

Body (campos usados pelo FiscoHub; a API aceita bem mais campos opcionais, mas estes bastam):

```json
{
  "name": "nome-do-arquivo.pdf",
  "base64_pdf": "<pdf em base64, SEM o prefixo data:application/pdf;base64,>",
  "external_id": "<assinaturaId interno do FiscoHub, pra casar com o webhook>",
  "lang": "pt-br",
  "signers": [
    {
      "name": "Nome do signatário",
      "email": "email@cliente.com",
      "phone_country": "55",
      "phone_number": "",
      "auth_mode": "assinaturaTela-tokenEmail",
      "send_automatic_email": false,
      "send_automatic_whatsapp": false
    }
  ]
}
```

Alternativas ao `base64_pdf`: `url_pdf` (URL pública do PDF), `url_docx`/`base64_docx` (Word), `markdown_text` (gera o PDF a partir de markdown).

`auth_mode` do signatário (métodos de autenticação, com custo por envio quando aplicável):

| auth_mode | Descrição | Custo |
|---|---|---|
| `assinaturaTela` | Assinatura na tela | Grátis |
| `tokenEmail` | Token por e-mail | Grátis |
| `assinaturaTela-tokenEmail` | Tela + token e-mail | Grátis |
| `tokenSms` | Token por SMS | R$ 0,10/envio |
| `tokenWhatsapp` | Token por WhatsApp | 5 créditos |
| `certificadoDigital` | Certificado digital | 5 créditos |

(1 crédito = R$ 0,10.) Para o FiscoHub, usar `assinaturaTela-tokenEmail` como padrão (sem custo).

Resposta 200:

```json
{
  "open_id": 5,
  "token": "eb9c367a-e62f-4992-8360-b0219deaeecc",
  "status": "pending",
  "name": "Contrato de Admissão João",
  "original_file": "https://zapsign.s3.amazonaws.com/pdf/.../arquivo.pdf",
  "signed_file": null,
  "created_at": "2020-04-16T03:33:46.241747Z",
  "signers": [
    {
      "token": "921c115d-4a6e-445d-bdca-03fadedbbc0b",
      "sign_url": "https://app.zapsign.com.br/verificar/921c115d-4a6e-445d-bdca-03fadedbbc0b",
      "status": "new",
      "name": "João da Silva",
      "email": "",
      "signed_at": null
    }
  ]
}
```

**Atenção:** `original_file` e `signed_file` são URLs temporárias (expiram em 60 minutos). Se precisar guardar o arquivo, baixe imediatamente e salve no MinIO — nunca persista essas URLs diretamente no banco.

Use `send_automatic_email: false` porque o FiscoHub já envia o e-mail de solicitação via `emailService.enviarSolicitacaoAssinatura` — não deixar a ZapSign mandar e-mail duplicado. O link de assinatura a enviar ao cliente é `signers[0].sign_url`.

### 2. Detalhar documento — `GET /docs/{doc_token}/`

Retorna todos os atributos do documento (status, signatários, links). Útil como fallback/reconciliação caso um webhook se perca (poll manual sob demanda, não em loop — a ZapSign recomenda usar webhook em vez de polling).

Status possíveis do **documento**: `pending` (em curso), `signed` (todos assinaram).
Status possíveis do **signatário**: `new`, `link-opened`, `signed` (na listagem paginada aparecem também como enum estável: `nao_abriu`, `abriu`, `assinou`, `recusou`, `expirou`, `cancelado`).

### 3. Listar documentos — `GET /docs/?page=1`

Paginado, com cache de 60s. Filtros úteis via query params: `status` (`pending`/`signed`/`refused`), `signer_email`, `created_from`/`created_to` (`YYYY-MM-DD`), `folder_path`, `deleted`, `include_signers` (`true` pra trazer o array de signatários já na listagem). Não é essencial pro fluxo principal do FiscoHub (que já guarda tudo em `AssinaturaDocumento`), mas útil para uma tela de auditoria/reconciliação manual se quiser implementar.

### 4. Excluir documento — `DELETE /docs/{doc_token}/`

Soft delete — o documento continua acessível via API/banco da ZapSign, só some da interface web. Ação sem volta (não tem "restaurar"). Útil se implementar cancelamento de uma solicitação de assinatura pelo FiscoHub.

### 5. Reenviar notificação em massa — `POST /docs/{doc_token}/resend-notifications-bulk/`

Sem body. Reenvia a notificação a todos os signatários pendentes (respeita ordem de assinatura se ativa). Tem cooldown entre reenvios (erro `429 cooldown_period` se chamar cedo demais). Útil para um botão "reenviar lembrete de assinatura" na tela de assinaturas do contador.

Resposta:

```json
{
  "success": true,
  "total_signers": 3,
  "sent_count": 2,
  "failed_count": 1,
  "failed_signers": [{ "name": "Fulano de Tal", "reason": "Sem email ou telefone" }],
  "has_order_active": true,
  "has_signature_groups": false
}
```

Erros possíveis: `400 document_not_in_progress`, `400 no_pending_signers`, `403 permission_denied`, `429 cooldown_period`, `500 internal_error`.

### 6. Configurar webhook — `POST /user/company/webhook/` (configurar uma única vez, não por documento)

```json
{
  "url": "https://SEU_DOMINIO/api/v1/webhooks/zapsign",
  "type": "",
  "headers": [{ "name": "X-Zapsign-Webhook-Secret", "value": "<ZAPSIGN_WEBHOOK_SECRET do .env>" }]
}
```

`type: ""` recebe todos os eventos de documento (`doc_signed`, `doc_created`, `doc_deleted`, `doc_refused`). O evento `email_bounce` precisa ser cadastrado separadamente (`type: "email_bounce"`), pois não vem incluído em `""`.

**Importante sobre segurança:** a ZapSign NÃO assina o payload do webhook com HMAC. A validação é feita conferindo que o header customizado configurado acima (`X-Zapsign-Webhook-Secret`) chega igual no request recebido — comparação simples de string (idealmente com `timingSafeEqual`), não HMAC como no DocSeal/SignatureAPI antigos.

### 7. Eventos de webhook (payloads reais)

**`doc_created`** — documento criado, ainda pendente:
```json
{
  "event_type": "doc_created",
  "token": "cce11abf-...",
  "external_id": "id-suaaplicacao-...",
  "status": "pending",
  "name": "sample.pdf",
  "original_file": "https://zapsign.s3.amazonaws.com/.../original.pdf",
  "signed_file": null,
  "signers": [{ "token": "b14f141f-...", "status": "new", "name": "...", "email": "..." }]
}
```

**`doc_signed`** — disparado a cada signatário que assina (conferir `status` no nível do documento pra saber se TODOS já assinaram, não só esse signatário):
```json
{
  "event_type": "doc_signed",
  "token": "cce11abf-...",
  "external_id": "id-suaaplicacao-...",
  "status": "signed",
  "signed_file": "https://zapsign.s3.amazonaws.com/.../assinado.pdf",
  "original_file": "https://zapsign.s3.amazonaws.com/.../original.pdf",
  "signer_who_signed": { "name": "Fulano Silva", "email": "...", "signed_at": "2021-06-07T19:22:19.956056Z", "cpf": "99999999999" },
  "signers": [{ "status": "signed", "name": "...", "email": "...", "signed_at": "..." }]
}
```

**`doc_refused`** — signatário recusou:
```json
{
  "event_type": "doc_refused",
  "token": "cce11abf-...",
  "external_id": "id-suaaplicacao-...",
  "status": "recusado",
  "rejected_reason": "Motivo da recusa do documento",
  "signers": [{ "status": "abriu-link", "name": "...", "email": "..." }]
}
```

**`doc_deleted`** — documento excluído (via API ou interface):
```json
{
  "event_type": "doc_deleted",
  "token": "cce11abf-...",
  "external_id": "id-suaaplicacao-...",
  "deleted": true,
  "deleted_at": "2021-06-07T19:22:33.932981Z"
}
```

**`doc_expired`** — documento expirou sem ser assinado por todos até `date_limit_to_sign`:
```json
{
  "event_type": "doc_expired",
  "token": "cce11abf-...",
  "external_id": "None",
  "status": "pending",
  "expiration_date": "2025-07-10T23:59:59.000999+00:00"
}
```

**`email_bounce`** — falha no envio do e-mail ao signatário (precisa cadastrar esse tipo de webhook separadamente):
```json
{
  "event_type": "email_bounce",
  "email": "teste@truora.com",
  "token": "853fda7d-...",
  "type": "link_email",
  "status": "dropped",
  "delivered": false,
  "error": "ZapSign did not send the message to this email address because there was a previous delivery failure..."
}
```

---

## Arquivos a remover por completo

- `src/infrastructure/docseal/` (pasta inteira)
- `src/infrastructure/signatureapi/` (pasta inteira)
- `app/api/v1/webhooks/docseal/` (pasta inteira)
- `app/api/v1/webhooks/signatureapi/` (pasta inteira)

## Arquivos a criar

- **`src/infrastructure/zapsign/ZapSignService.ts`** — classe `ZapSignService` com:
  - `isConfigured()`: `boolean`
  - `criarAssinatura(fileName, pdfBase64, signatarioNome, signatarioEmail, assinaturaId)`: cria documento via `POST /docs/`, retorna `{ docToken, linkAssinatura }`
  - `excluirDocumento(docToken)`: `DELETE /docs/{doc_token}/` (opcional, pra suportar cancelamento)
  - `reenviarNotificacao(docToken)`: `POST /docs/{doc_token}/resend-notifications-bulk/` (opcional, pra um botão de "reenviar lembrete")
  - `detalharDocumento(docToken)`: `GET /docs/{doc_token}/` (opcional, fallback de reconciliação)
  Seguir o mesmo estilo de `SignatureApiService.ts` (que vai ser removido) como referência de formatação/tratamento de erro/logs.

- **`app/api/v1/webhooks/zapsign/route.ts`** — seguir a estrutura do `app/api/v1/webhooks/signatureapi/route.ts` atual:
  - Idempotência via `WebhookEventLog` com `eventKey: zapsign:${token}:${event_type}` (incluir o tipo de evento na chave, já que o mesmo `token` de documento gera múltiplos eventos ao longo do tempo — `doc_created`, depois `doc_signed`).
  - Validar o header customizado (`X-Zapsign-Webhook-Secret`) antes de processar qualquer coisa.
  - Buscar `AssinaturaDocumento` por `zapsignDocToken` OU pelo `external_id` (fallback).
  - Tratar `doc_signed`: baixar `signed_file` (URL expira em 60min, baixar na hora), salvar no MinIO, marcar status `ASSINADO`, `assinadoAt`, notificar solicitante por e-mail, gravar `AuditLog` (`ASSINATURA_CONCLUIDA`).
  - Tratar `doc_refused`: marcar status `RECUSADO`, `motivoRecusa` = `rejected_reason`, notificar solicitante, gravar `AuditLog` (`ASSINATURA_RECUSADA`).
  - Tratar `doc_expired`: marcar status `EXPIRADO` (já existe esse valor em `StatusAssinaturaDoc`).
  - `doc_created` e `doc_deleted`: só logar, sem ação necessária (a criação já é síncrona na resposta do POST; delete não é fluxo normal do FiscoHub).
  - `email_bounce`: logar como warning e, se quiser, notificar o contador que o e-mail do cliente falhou (não crítico, pode deixar só logado na primeira versão).

## Arquivos a editar

**`prisma/schema.prisma`**
- `enum ProviderAssinatura { INTERNO DOCSEAL SIGNATUREAPI }` → `enum ProviderAssinatura { INTERNO ZAPSIGN }`
- Model `AssinaturaDocumento`: remover `docsealSubmissionId` e `signatureapiEnvelopeId`, adicionar `zapsignDocToken String? @map("zapsign_doc_token") @db.VarChar(255)`
- Gerar migration nova (não editar migrations antigas). Como o Postgres não permite remover valor de enum numa transação simples, a migration precisa: 1) `UPDATE` de qualquer linha existente com `provider_assinatura`/`provider` igual a `DOCSEAL`/`SIGNATUREAPI` para `INTERNO` (tabelas `usuario_cliente`, `configuracao_escritorio`, `assinatura_documento`); 2) recriar o tipo enum sem esses valores (renomear o tipo antigo, criar o novo só com `INTERNO`/`ZAPSIGN`, alterar as colunas com `USING coluna::text::novo_tipo`, dropar o tipo antigo). Rodar primeiro em dev/staging.

**`src/infrastructure/di/Container.ts`** — trocar import/instanciação de `DocSealService`/`SignatureApiService` por `ZapSignService`, lendo `ZAPSIGN_API_TOKEN` do env.

**`app/api/v1/documentos/[id]/assinatura/route.ts`** — trocar os dois branches `SIGNATUREAPI`/`DOCSEAL` por um único branch `ZAPSIGN` chamando `zapSignService.criarAssinatura(...)`, salvando `zapsignDocToken` em vez dos dois campos antigos.

**`app/api/v1/admin/contadores/route.ts`**, **`app/api/v1/admin/contadores/[id]/route.ts`**, **`app/api/v1/admin/clientes/[id]/route.ts`** — trocar `z.enum(['INTERNO','DOCSEAL','SIGNATUREAPI'])` por `z.enum(['INTERNO','ZAPSIGN'])`.

**`app/api/v1/assinaturas/route.ts`** — trocar os campos selecionados/retornados `docsealSubmissionId`/`signatureapiEnvelopeId` por `zapsignDocToken`.

**UI (React):**
- `app/(admin)/admin-clientes/page.tsx` e `app/(admin)/contadores/page.tsx` — trocar `<option value="DOCSEAL">`/`<option value="SIGNATUREAPI">` por `<option value="ZAPSIGN">ZapSign</option>`, e os badges condicionais na tabela.
- `app/(contador)/assinaturas/page.tsx` — atualizar type do provider, texto renderizado ("DocSeal"/"SignatureAPI"/"Sistema Interno" → "ZapSign"/"Sistema Interno") e campo no drawer de detalhes ("ID DocSeal"/"Envelope ID" → "Token ZapSign"). Se quiser, adicionar um botão "Reenviar lembrete" chamando o novo endpoint de reenvio em massa.
- `app/assinar/[token]/page.tsx` — trocar type `'INTERNO' | 'DOCSEAL' | 'SIGNATUREAPI'` por `'INTERNO' | 'ZAPSIGN'` e a condição `if ((d.provider === 'DOCSEAL' || d.provider === 'SIGNATUREAPI') && d.linkExterno)` por `if (d.provider === 'ZAPSIGN' && d.linkExterno)`.
- `app/(contador)/components/HelpTutorialModal.tsx` — trocar texto que menciona "SignatureAPI" pra mencionar ZapSign.
- `app/page.tsx` (landing page) — trocar o card de feature que cita "DocSeal" pra citar ZapSign.
- `app/(admin)/planos/page.tsx` — ajustar texto do feature "assinatura_eletronica" que cita DocSeal.

**Variáveis de ambiente** (`.env`, `.env.example`, `.env.production`) — remover todo o bloco `DOCSEAL_*` e `SIGNATUREAPI_*`, adicionar:
```
ZAPSIGN_API_TOKEN=
ZAPSIGN_WEBHOOK_SECRET=
```

**`docker-compose.yml`** — remover o serviço `docseal` inteiro, remover a dependência `docseal: condition: service_started` do serviço `app`, remover as env vars `DOCSEAL_*`/`SIGNATUREAPI_*` repassadas ao container `app`, adicionar `ZAPSIGN_API_TOKEN`/`ZAPSIGN_WEBHOOK_SECRET`.

## Verificação ao final

1. `npm run type-check` sem erros.
2. `npx prisma validate` e `npx prisma migrate dev` (ambiente local/staging) rodando limpo.
3. `npm run lint`.
4. `npm run test` (vitest) passando.
5. `grep -rniE "docseal|signatureapi" --include=*.ts --include=*.tsx .` não deve retornar nada fora de `node_modules`, `.next`, migrations antigas e `docs/superpowers/plans/2026-05-29-docseal.md` (histórico, pode ficar).
6. Cadastrar o webhook via `POST /user/company/webhook/` no ambiente de sandbox e testar ponta a ponta: solicitar assinatura de um documento de teste, assinar via ZapSign sandbox, confirmar que `doc_signed` chega, atualiza o status e salva o PDF assinado no MinIO. Testar também o cenário de recusa (`doc_refused`).
