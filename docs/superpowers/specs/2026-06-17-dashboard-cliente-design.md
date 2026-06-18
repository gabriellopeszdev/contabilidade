# Dashboard do Cliente — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar a página `/dashboard` no portal do cliente com KPIs visuais, gráficos de documentos por mês e por setor, atividade recente e boletos pendentes — dando ao cliente uma visão analítica completa da sua situação contábil.

**Abordagem:** Nova rota `/dashboard` independente do `/inicio`. Reutiliza `ClienteDashboardCharts.tsx` e o endpoint `/api/v1/dashboard/cliente/charts` já existentes. Adiciona link "Dashboard" na sidebar do layout do cliente (`app/(cliente)/layout.tsx`).

**Arquivo principal:** `app/(cliente)/dashboard/page.tsx` (novo)
**Arquivo modificado:** `app/(cliente)/layout.tsx` (adicionar nav item)

---

## Seção 1 — Navegação

Adicionar item "Dashboard" na sidebar em `app/(cliente)/layout.tsx`, logo abaixo de "Início":

```
Início        → /inicio
Dashboard     → /dashboard   ← novo (ícone: LayoutDashboard)
```

Grupo: sem grupo (junto com "Início", antes de "DOCUMENTOS").

---

## Seção 2 — Topo: KPI Cards

Quatro cards em linha (`grid grid-cols-2 lg:grid-cols-4 gap-4`), cada um com ícone colorido, valor em destaque e label.

| # | Label | Valor | Ícone | Cor |
|---|---|---|---|---|
| 1 | Enviados este mês | `enviadosMes` (count) | `Send` | emerald |
| 2 | Recebidos do contador | `novosDoContador` (não lidos) | `Bell` | primary/azul |
| 3 | Em aberto (boletos) | `formatarMoeda(valorAberto)` | `DollarSign` | vermelho se vencidos, âmbar se em aberto, cinza se zerado |
| 4 | Próximo vencimento | `diasAteVencer` dias ou "—" | `CalendarClock` | âmbar se ≤ 5 dias |

Dados de boletos: fetch direto de `/api/v1/financeiro/boletos?limit=50`.
Dados de documentos: `useDocumentosCliente()` — já exporta `documentos`, `carregando`.

Loading state: cada card mostra `—` enquanto carrega, sem skeleton elaborado.

---

## Seção 3 — Gráficos

Dois painéis lado a lado: `grid grid-cols-1 lg:grid-cols-5 gap-6`.

### Uso do componente

`ClienteDashboardCharts` (em `src/presentation/components/dashboard/ClienteDashboardCharts.tsx`) já renderiza **ambos os gráficos** internamente num `grid grid-cols-1 sm:grid-cols-2` — BarChart de documentos por mês (esquerda) e PieChart por setor (direita). Ele faz seu próprio fetch de `/api/v1/dashboard/cliente/charts` via SWR e só precisa receber `{ token }`.

Usar o componente como está, numa **única seção de largura total** com card wrapper simples:

```tsx
<section>
  <ClienteDashboardCharts token={token} />
</section>
```

Não é necessário adaptar o componente nem dividir em dois cards separados. O grid interno do componente já produz o layout correto.

---

## Seção 4 — Base: Duas Colunas

`grid grid-cols-1 lg:grid-cols-2 gap-6`

### Coluna esquerda — Atividade Recente

Card com header "Atividade Recente" + link "Ver todos →" para `/documentos`.

Lista dos últimos **8 documentos** do cliente (enviados + recebidos misturados), ordenados por `createdAt` desc. Fonte: `useDocumentosCliente()` com `page=1, perPage=8` sem filtro de origem.

Cada item da lista:
```
[ícone de origem] [nome do arquivo truncado]    [data]
                  [badge de setor] [badge NOVO se não lido]
```

- Origem `UPLOAD_CLIENTE` → ícone `Send` emerald (enviado por mim)
- Origem `UPLOAD_CONTADOR` → ícone `Download` azul (recebido do contador)
- Estado vazio: "Nenhum documento ainda." com ícone `FileText`

### Coluna direita — Boletos Pendentes

Card com header "Boletos Pendentes" + link "Ver todos →" para `/financeiro`.

Lista os **boletos com status `PENDENTE` ou `VENCIDO`**, máximo 5, ordenados por vencimento asc.

Cada item:
```
[ícone DollarSign com cor]  [descrição ou mesReferencia]    [valor em negrito]
                             [data vencimento]               [badge VENCIDO / EM ABERTO]
```

- Vencido: badge vermelho + valor vermelho
- Em aberto: badge âmbar + valor âmbar
- Estado vazio: "Nenhum boleto pendente." com ícone `CheckCircle2` verde

---

## Seção 5 — Estrutura de Arquivos

| Arquivo | Ação |
|---|---|
| `app/(cliente)/dashboard/page.tsx` | Criar — página principal |
| `app/(cliente)/layout.tsx` | Modificar — adicionar nav item Dashboard |
| `src/presentation/components/dashboard/ClienteDashboardCharts.tsx` | Usar como está — sem modificação |

---

## Seção 6 — Responsividade

| Breakpoint | KPI Cards | Gráficos | Base |
|---|---|---|---|
| mobile (< lg) | 2 colunas | 1 coluna (mensal em cima, setor embaixo) | 1 coluna (atividade, depois boletos) |
| desktop (≥ lg) | 4 colunas | 3/5 + 2/5 | 2 colunas |

---

## Seção 7 — Padrões Visuais

Seguir o mesmo estilo de `app/(cliente)/inicio/page.tsx`:
- Container: `p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6`
- Cards: `bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700`
- Headers de card: `px-5 py-4 border-b border-gray-100 dark:border-gray-700`
- Cores de ícones nos KPI cards: `bg-{cor}/10 rounded-xl p-2.5`

---

## Verificação

- `npm run type-check` — zero erros TypeScript
- Testar: desktop e mobile
- Testar estado vazio (sem boletos, sem documentos)
- Testar dark mode
- Verificar que link "Dashboard" na sidebar fica ativo (`/dashboard`) e "Início" não fica ativo simultaneamente
