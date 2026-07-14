# FiscoHub — Mapeamento Completo do Projeto

Documento gerado em 13/07/2026 a partir da varredura completa do repositório.

## 1. Visão geral

SaaS de gestão contábil self-hosted (Docker), multi-tenant, para escritórios de contabilidade e seus clientes. Três papéis de usuário: Super Admin (dono do SaaS), Contador/Escritório (e seus Funcionários), e Cliente (e seus Funcionários). Conformidade LGPD é preocupação de primeira classe (consentimento, auditoria, exportação/anonimização).

**Stack:** Next.js 16 (App Router) + TypeScript, servidor HTTP customizado (`server.ts`) rodando por cima do Next para embutir Socket.IO, PostgreSQL 16 via Prisma 7 (driver adapter `@prisma/adapter-pg`, pool `pg`), Redis (BullMQ + pub/sub de eventos + websockets), MinIO (armazenamento de arquivos, com endpoint público via Nginx para presigned URLs), Pino (logs estruturados), Zod (validação), Tailwind.

**Arquitetura:** Clean Architecture / DDD com 4 camadas em `src/`: domain, application, infrastructure, presentation, mais `shared` (kernel) e `config`. `src/infrastructure/di/Container.ts` é o composition root — único lugar onde adapters concretos são instanciados (singletons HMR-safe via `globalThis`).

## 2. Camada de domínio (`src/domain`)

- **Entidades:** AuditLog, DocumentoFiscal, TarefaKanban, UsuarioCliente, UsuarioContador.
- **Value Objects:** CNPJ, CRC, Email, SenhaHash, Setor.
- **Eventos de domínio:** DocumentoVisualizadoEvent, NovoComunicadoEvent, NovoDocumentoUploadEvent.
- **Exceções:** DomainException, InvalidTransitionException.
- **Ports (interfaces):** IAuditLogRepository, IDocumentoRepository, IEmailService, IEventDispatcher, ILogger, IPasswordHasher, IStorageService, ITarefaRepository, IUsuarioRepository.

Observação: o domínio modela só uma fração do sistema (documentos, tarefas, auditoria, usuários). Boletos, assinaturas, comunicados, chat, etc. não têm entidades de domínio próprias — vivem como models Prisma manipulados diretamente pelas rotas de API.

## 3. Camada de aplicação (`src/application`)

Ainda enxuta — só 2 use cases formais:
- `ProcessarUploadLoteUseCase` (com `UploadLoteDTO`)
- `RegistrarLeituraDocumentoUseCase` (com `RegistrarLeituraDTO`)
- `DocumentoMapper` (mapper application ↔ domínio)

A maior parte da lógica de negócio das 130 rotas de API roda diretamente nos route handlers, não em use cases — ponto de atenção arquitetural para evolução futura.

## 4. Infraestrutura (`src/infrastructure`)

| Pasta | Conteúdo |
|---|---|
| `asaas/` | `AsaasService.ts` — cobrança (boletos, PIX, assinaturas de honorários e do próprio SaaS) |
| `cora/` | `CoraService.ts` — banking (OAuth2 + mTLS com certificado) |
| `docseal/` | `DocSealService.ts` — assinatura eletrônica (self-hosted, roda como serviço no docker-compose) |
| `signatureapi/` | `SignatureApiService.ts` — assinatura eletrônica (provider externo alternativo) |
| `auth/` | `BcryptPasswordHasher`, `ScryptPasswordHasher` |
| `email/` | `ResendEmailAdapter` (produção), `ConsoleEmailAdapter` (fallback/dev), templates (lembrete de obrigação, solicitação de assinatura) |
| `database/` | `PrismaDocumentoRepository`, `PrismaAuditLogRepository` |
| `di/` | `Container.ts` — composition root |
| `events/` | `RedisEventDispatcher` |
| `http/middlewares/` | `withAuth`, `withRequestLogging` |
| `http/validators/` | `UploadLoteSchema` (Zod) |
| `logger/` | `PinoLogger`, `RequestContext` |
| `notifications/` | `NotificacaoService` |
| `pdf/` | `gerarBoletoPdf`, `normalizarPdf` |
| `queue/` | `BullMQAdapter` + jobs: `gerarObrigacoesRecorrentesJob`, `gerarRelatorioMensalJob`, `parsearXmlNfeJob`, `verificarLembretesJob` |
| `storage/` | `MinIOStorageAdapter` (com suporte a endpoint público separado para presigned URLs) |
| `websockets/` | `SocketServer` (Socket.IO sobre Redis pub/sub, path `/api/ws`) |

`src/lib/`: `exporters/excelExporter.ts`, `exporters/pdfExporter.ts`, `nfe/nfeParser.ts`, `totp.ts` (2FA).
`src/utils/`: `aiClient.ts` + `aiProviders.ts` (abstração multi-provider: Anthropic/OpenAI/Google/DeepSeek), `csv.ts`, `encryption.ts`, `logger.ts`, `nfeParser.ts`, `planLimits.ts`, `rateLimiter.ts`, `validators.ts`.

## 5. Apresentação (`src/presentation`)

Componentes organizados por feature: `billing/` (bloqueio por inadimplência), `chat/`, `cliente/` (cadastro, tabela de documentos, upload em lote), `comunicados/`, `dashboard/` (variantes por papel: dono/funcionário × contador/cliente), `financeiro/`, `kanban/` (drag-and-drop via `@dnd-kit`), `lgpd/` (modal de consentimento, rodapé institucional), `upload/`.

Hooks: `useAuth`, `useChat`, `useComunicados`, `useDarkMode`/`useTheme`, `useDocumentosCliente`, `useKanban`, `useNotificacoes`, `usePlanoAtual`, `useSessionTimer`, `useUploadLote`. Um `AuthContext` central.

## 6. Rotas da aplicação (`app/`)

Três route groups por papel, mais páginas públicas:

**`(admin)`** — painel do dono do SaaS: admin-boletos, admin-clientes, admin-config, auditoria, contadores, dashboard-admin, faturamento, feedbacks, planos, webhook-logs.

**`(contador)`** — escritório: assinaturas, busca, calendario, chat-ia, clientes/[id], comunicados/[id], configuracoes, dashboard, equipe, kanban, lote, nfe, relatorios.

**`(cliente)`** — cliente final: ajuda, conta, documentos, enviar, informativos/[id], inicio, minha-equipe, minhas-assinaturas, painel.

**Públicas:** login, cadastro, onboarding, auth/ativar-conta, auth/recuperar-senha/[token], assinar/[token] (assinatura eletrônica via link), financeiro, manutencao (modo manutenção), privacidade, termos, chat (standalone).

## 7. API — 130 rotas em `/api/v1` + `/api/health`

| Domínio | Rotas | Destaques |
|---|---|---|
| admin | 23 | CRUD contadores (asaas/cora/ia/plano/senha/status por contador), boletos, clientes, faturamento, nps, planos, stats, subscrições, webhook-logs, sistema/ia |
| auth | 17 | login/logout/me, 2FA completo (setup/enable/disable/verify/backup), ativação de conta, troca/reset de senha, consentimento LGPD, audit-log próprio, preferências de notificação |
| documentos | 12 | CRUD, versões + download por versão, assinatura, metadata, responsáveis, setor, upload em lote, upload pelo cliente, download em lote |
| clientes | 8 | CRUD, chat, documentos, export, obrigações via IA, regime tributário via IA, reenvio de convite |
| financeiro | 8 | boletos (+ download, estorno, export), assinaturas de honorário, resumo Asaas |
| calendario | 5 | eventos, obrigações (+ críticas), instâncias (+ concluir) |
| chat | 5 | equipe, rooms (+ anexo), unread |
| webhooks | 5 | asaas, asaas-saas, cora, docseal, signatureapi |
| escritorio | 5 | config (+ logo), ia, integração (cora) |
| dashboard | 4 | stats, activity, charts (contador e cliente) |
| assinatura (eletrônica, token público) | 4 | otp, otp/verificar, pdf |
| comunicados | 4 | CRUD, confirmar, destinatários |
| nfe | 4 | analisar, importar, recebidas (+ visualizar) |
| relatorios | 3 | clientes, documentos, financeiro |
| kanban | 3 | CRUD, responsável, status |
| notificacoes | 3 | CRUD, lida, todas-lidas |
| cliente | 3 | assinaturas, equipe |
| equipe / assinaturas / minha-assinatura / plano | 2 cada | — |
| busca, cadastro, chat-ia, nps, onboarding, planos | 1 cada | — |

Ponto de atenção: com só 2 use cases formais para 130 rotas, a maior parte da regra de negócio está inline nos `route.ts` — não é uma violação da Clean Architecture per se (ainda usa os ports/adapters via Container), mas está fora do padrão use-case explícito que o domínio sugere.

## 8. Banco de dados — 26 modelos Prisma (40 migrações)

**Usuários e organização:** UsuarioCliente, UsuarioContador (com `isAdmin` para super admin), ContadorCliente (N:N carteira de clientes), Funcionario (vínculo ESCRITORIO ou CLIENTE, com `setores[]` restringindo acesso).

**Documentos:** DocumentoFiscal (soft delete, hash SHA-256 p/ dedupe, JSON metadata, índices compostos por setor/tipo/competência), DocumentoVersao (histórico), DocumentoResponsavel (atribuição a funcionários).

**Produtividade:** TarefaKanban (estados PENDING→PROCESSING→REVIEW→DONE, prioridade, posição drag-and-drop), AuditLog (append-only, nunca update/delete, comentário no schema já prevê particionamento por mês em produção).

**Comunicação:** ChatRoom/ChatMessage (chat contador↔cliente com anexos), Comunicado/ComunicadoDestinatario (avisos com confirmação de leitura rastreada), ChatIaMensagem (histórico do chat com IA), Notificacao (central in-app, sem FK — userId genérico p/ ambos os tipos de usuário).

**Fiscal/calendário:** ObrigacaoFiscal (recorrência mensal/bimestral/trimestral/semestral/anual, lembretes configuráveis), InstanciaObrigacao (ocorrências geradas por mês de referência).

**Financeiro:** BoletoHonorario e AssinaturaHonorario (campos espelhados para Asaas e Cora — dois gateways de pagamento suportados em paralelo), WebhookEventLog (idempotência via `eventKey` único), PlanoSaaS/AssinaturaSaaS/CobrancaSaaS (billing do próprio SaaS, também via Asaas).

**Assinatura eletrônica:** AssinaturaDocumento — suporta 3 providers (`INTERNO`, `DOCSEAL`, `SIGNATUREAPI`) no mesmo modelo, com token de acesso público, OTP, IP de assinatura, hash do documento, comprovante.

**Config/diversos:** ConfiguracaoEscritorio (white-label: logo, cores, chaves Asaas/Cora/IA por escritório), ConfiguracaoSistema (singleton `id='system'` para config global de IA), NpsResponse.

**Convenções do schema:** UUIDs via `gen_random_uuid()`, soft delete (`deletedAt`) em entidades mutáveis, `snake_case` no banco via `@map`, comentários extensos explicando decisões de índice.

## 9. Integrações externas

- **Asaas** — cobrança (boletos, PIX, assinaturas), usado tanto para honorários cliente→escritório quanto para billing SaaS escritório→plataforma.
- **Cora** — banking alternativo (OAuth2 + certificado mTLS armazenado criptografado, ver migration `encrypt_cora_keys`).
- **DocSeal** — assinatura eletrônica self-hosted (roda como serviço próprio no docker-compose).
- **SignatureAPI** — assinatura eletrônica via provider externo.
- **IA multi-provider** — Anthropic, OpenAI, Google (Gemini) configuráveis por escritório (`ia_provider`/`ia_api_key` em ConfiguracaoEscritorio) e globalmente (ConfiguracaoSistema); usado no chat-ia, sugestão de obrigações e regime tributário.
- **Resend** — envio de email transacional (fallback: log no console).

## 10. Infraestrutura de execução

**docker-compose.yml** — serviços: `postgres`, `redis`, `minio` + `minio_init`, `docseal`, `pg_backup`, `app`, rede `contabilidade_net`.
**Dockerfile**, `docker-entrypoint.sh`, `deploy.sh`, `update.sh`, `.github/workflows/deploy.yml` (CI/CD).
**Nginx** — `nginx/nginx.conf`, `nginx/deploy.conf`, `nginx/loading.html` (proxy reverso + servir MinIO publicamente + página de manutenção).
**BullMQ** — worker com concorrência 2, jobs agendados: lembrete de boleto, geração de obrigações recorrentes, verificação de lembretes, parse assíncrono de XML de NFe, relatório mensal.
**Socket.IO** — mesmo `httpServer` do Next, path `/api/ws`, backend Redis pub/sub para escalar horizontalmente.

## 11. Testes

Vitest, cobertura pontual: `ProcessarUploadLoteUseCase`, `RegistrarLeituraDocumentoUseCase`, `PaginationHelper`, `Result`, `csv`, `rateLimiter`. Nenhum teste de integração de API, componente React ou dos serviços de infraestrutura (Asaas/Cora/DocSeal/SignatureAPI).

## 12. Documentação interna (`docs/superpowers/`)

Histórico cronológico de specs + plans (formato "superpowers" — spec de design + plano de implementação por feature):

1. 23/05 — Features implementation (spec + plan gerais)
2. 26/05 — 2FA
3. 26/05 — Assinatura eletrônica
4. 26/05 — Exportação PDF/Excel
5. 26/05 — Histórico de versões
6. 26/05 — Lembretes de obrigações
7. 26/05 — OCR/XML de NFe
8. 26/05 — Onboarding, NPS e modo manutenção
9. 29/05 — Integração DocSeal
10. 12/06 — Notificações por email (+ spec de design)
11. 12/06 — UX/Acessibilidade (+ spec de design)
12. 17/06 — Dashboard do cliente (+ spec de design)
13. 17/06 — Redesign da página inicial do cliente (+ spec de design)
14. 13/07 — Comunicados (+ spec de design) — feature mais recente

## 13. Arquivos soltos / possível limpeza

Na raiz do projeto há vários arquivos que parecem artefatos temporários e não fazem parte do código-fonte: `bkp.txt` (vazio), `nfe-teste.xml` e `nfe-teste copy.xml` (fixtures de teste manual), `Screenshot_1.png` a `Screenshot_8.png`, `Assas.md`, `asaas-rotas.docx`, `arquitetura-sistema-contabil-v2.pdf`, `nginx-502.conf` (parece duplicar/sobrepor `nginx/`), `docker-compose.override.yml`. Nenhum é referenciado por código ou build — candidatos a mover para uma pasta `docs/` ou remover, se desejar organizar o repositório.

## 14. Pontos de atenção arquitetural

- **Use cases subdesenvolvidos**: só 2 formalizados para 130 rotas de API; a maior parte da regra de negócio roda direto nos route handlers.
- **Cobertura de testes baixa**: nada de integração de API, componentes ou serviços externos (Asaas/Cora/DocSeal/SignatureAPI/IA) sob teste automatizado.
- **Dois gateways de pagamento em paralelo** (Asaas + Cora) e **três providers de assinatura eletrônica** (Interno/DocSeal/SignatureAPI) aumentam a superfície de manutenção — todos coexistem no mesmo schema via campos opcionais espelhados.
- **AuditLog crescerá indefinidamente**: o próprio schema já documenta a necessidade de particionamento por mês em produção (`PARTITION BY RANGE (timestamp)`), ainda não aplicado via migration.
- **Multi-provider de IA** (Anthropic/OpenAI/Google) configurável por escritório E globalmente — bom para flexibilidade, mas exige testes de fallback quando a chave de um escritório específico falha.
