# Redesign /inicio Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar `app/(cliente)/inicio/page.tsx` para ter hierarquia visual clara: mini-stats inline com a saudação, corpo em duas colunas (documentos do contador à esquerda, upload compacto à direita), sem a seção "Ações Rápidas".

**Architecture:** Modificação de arquivo único. O layout do topo passa de saudação + grid de 4 cards separado para saudação + 4 mini-stats em linha. O corpo passa de `lg:grid-cols-3` (2/3 docs + 1/3 ações rápidas) para `lg:grid-cols-5` (3/5 docs + 2/5 upload compacto).

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Lucide React. Sem novas dependências.

---

## Estrutura de Arquivos

```
Modify: app/(cliente)/inicio/page.tsx
```

Único arquivo modificado. Nenhuma criação de arquivo.

---

## Task 1: Mini-stats inline com saudação + remover grid de stat cards

**Files:**
- Modify: `app/(cliente)/inicio/page.tsx` — seção do topo (~linhas 295-489)

- [ ] **Step 1: Substituir o bloco de saudação atual**

Localizar este bloco no arquivo (começa em `{/* ── Saudação ──`):

```tsx
      {/* ── Saudação ──────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {saudacao}, {primeiroNome}!
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{dataFormatada}</p>
        </div>
        {novosDoContador > 0 && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 text-xs font-semibold text-primary-dark dark:text-primary">
            <Bell size={13} className="animate-pulse" />
            {novosDoContador} novo{novosDoContador > 1 ? 's' : ''} do contador
          </div>
        )}
      </div>
```

Substituir por:

```tsx
      {/* ── Saudação + Mini-stats ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {saudacao}, {primeiroNome}!
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{dataFormatada}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-2">
          {/* Novos docs */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
            novosDoContador > 0
              ? 'bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
            <Bell size={14} className={`shrink-0 ${novosDoContador > 0 ? 'text-primary' : 'text-gray-400'}`} />
            <div>
              <p className={`text-sm font-bold leading-none ${novosDoContador > 0 ? 'text-primary-dark dark:text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                {docsCarregando ? '—' : novosDoContador}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">Docs novos</p>
            </div>
          </div>

          {/* Boletos */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
            boletosVencidos.length > 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : boletosAbertos.length > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
            <DollarSign size={14} className={`shrink-0 ${
              boletosVencidos.length > 0 ? 'text-red-500' :
              boletosAbertos.length > 0 ? 'text-amber-500' : 'text-gray-400'
            }`} />
            <div>
              <p className={`text-sm font-bold leading-none ${
                boletosVencidos.length > 0 ? 'text-red-700 dark:text-red-400' :
                boletosAbertos.length > 0 ? 'text-amber-700 dark:text-amber-400' :
                'text-gray-700 dark:text-gray-300'
              }`}>
                {boletosCarregando ? '—' : boletosAbertos.length > 0 ? formatarMoeda(valorAberto) : 'R$ 0'}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                {boletosVencidos.length > 0
                  ? `${boletosVencidos.length} vencido${boletosVencidos.length > 1 ? 's' : ''}`
                  : boletosAbertos.length > 0
                    ? `${boletosAbertos.length} em aberto`
                    : 'Sem boletos'}
              </p>
            </div>
          </div>

          {/* Enviados */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
            <Send size={14} className="text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-bold leading-none text-gray-700 dark:text-gray-300">
                {docsCarregando ? '—' : enviadosMes}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">Enviados/mês</p>
            </div>
          </div>

          {/* Vencimento */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
            diasAteVencer !== null && diasAteVencer <= 5
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
            <CalendarClock size={14} className={`shrink-0 ${diasAteVencer !== null && diasAteVencer <= 5 ? 'text-amber-500' : 'text-primary'}`} />
            <div>
              <p className={`text-sm font-bold leading-none ${
                diasAteVencer !== null && diasAteVencer <= 5
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {boletosCarregando ? '—' : diasAteVencer === null ? '—' : diasAteVencer === 0 ? 'Hoje' : `${diasAteVencer}d`}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                {proximoVencimento ? `Venc. ${formatarData(proximoVencimento.toISOString())}` : 'Sem vencimento'}
              </p>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Remover o bloco inteiro de 4 stat cards separados**

Localizar e **deletar** o bloco que começa com `{/* ── 4 Cards de status ──` e termina no `</div>` que fecha o `grid grid-cols-2 lg:grid-cols-4 gap-3`. O bloco completo a remover:

```tsx
      {/* ── 4 Cards de status ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Novos documentos */}
        <div className={`rounded-2xl border p-4 space-y-3 transition-colors
          ${novosDoContador > 0
            ? 'bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          }`}>
          ... (todo o conteúdo interno dos 4 cards)
        </div>

      </div>
```

O bloco vai da linha que contém `{/* ── 4 Cards de status` até o `</div>` correspondente (após o card "Próximo vencimento"). Deletar tudo isso.

- [ ] **Step 3: Verificar type-check**

```bash
npm run type-check
```

Esperado: zero erros.

- [ ] **Step 4: Commit**

```bash
git add app/\(cliente\)/inicio/page.tsx
git commit -m "refactor(inicio): move stats to inline header row, remove stat card grid"
```

---

## Task 2: Duas colunas no corpo + upload compacto na direita + remover Ações Rápidas

**Files:**
- Modify: `app/(cliente)/inicio/page.tsx` — seção do corpo (~linhas 321-709)

- [ ] **Step 1: Remover o bloco de upload do topo**

Localizar e **deletar** este bloco inteiro (começa com `{/* ── Enviar Documentos`):

```tsx
      {/* ── Enviar Documentos (Categorias de Upload) ────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CloudUpload size={18} className="text-primary" />
            O que você precisa enviar hoje para o contador?
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Selecione a categoria correspondente para escolher e enviar seus arquivos.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIAS.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCardClick(cat)}
                className={`
                  group relative flex flex-col items-center text-center
                  rounded-xl border-2 p-3 sm:p-4
                  transition-all duration-200 cursor-pointer
                  hover:shadow-md hover:-translate-y-0.5 active:scale-95
                  ${cat.cor.cardBg} ${cat.cor.cardBorder} ${cat.cor.cardHover}
                `}
              >
                {/* Ícone com gradiente */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110 bg-gradient-to-br ${cat.cor.gradient}`}>
                  <Icon size={18} className="text-white" aria-hidden="true" />
                </div>

                {/* Título */}
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1">
                  {cat.label}
                </p>

                {/* Descrição */}
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                  {cat.descricao}
                </p>
              </button>
            );
          })}
        </div>
      </div>
```

- [ ] **Step 2: Substituir o grid principal (duas colunas) e remover Ações Rápidas**

Localizar este bloco:

```tsx
      {/* ── Grid principal ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
```

Substituir a linha do grid:

```tsx
      {/* ── Grid principal ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
```

Em seguida, localizar a abertura da section esquerda:

```tsx
        <section className="lg:col-span-2 space-y-4">
```

Substituir por (adiciona `order-2 lg:order-1` para mobile: upload aparece antes dos docs):

```tsx
        <section className="lg:col-span-3 space-y-4 order-2 lg:order-1">
```

- [ ] **Step 3: Substituir a aside "Ações Rápidas" por upload compacto**

Localizar e **deletar** o bloco inteiro da aside que começa com:

```tsx
        {/* ============================================================== */}
        {/* COLUNA DIREITA — Envio + Ações                                  */}
        {/* ============================================================== */}
        <aside className="space-y-4">

          {/* Ações Rápidas */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Ações Rápidas</p>

            <Link href="/documentos"
              ...
            </Link>

            <Link href="/enviar"
              ...
            </Link>

            <Link href="/chat"
              ...
            </Link>
          </div>
        </aside>
```

Substituir por:

```tsx
        {/* ============================================================== */}
        {/* COLUNA DIREITA — Upload Compacto                                 */}
        {/* ============================================================== */}
        <aside className="lg:col-span-2 space-y-3 order-1 lg:order-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <CloudUpload size={16} className="text-primary" />
              Enviar para o Contador
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Selecione a categoria do arquivo
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {CATEGORIAS.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCardClick(cat)}
                  className={`
                    group relative flex flex-col items-center text-center
                    rounded-xl border-2 p-3
                    transition-all duration-200 cursor-pointer
                    hover:shadow-md hover:-translate-y-0.5 active:scale-95
                    ${cat.cor.cardBg} ${cat.cor.cardBorder} ${cat.cor.cardHover}
                  `}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-transform duration-200 group-hover:scale-110 bg-gradient-to-br ${cat.cor.gradient}`}>
                    <Icon size={15} className="text-white" aria-hidden="true" />
                  </div>
                  <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100 leading-tight mb-0.5">
                    {cat.label}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                    {cat.descricao}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>
```

- [ ] **Step 4: Remover imports não utilizados**

Após remover as "Ações Rápidas", os ícones `History` e `MessageSquare` não são mais usados no JSX (só eram usados nos links removidos). Verificar no topo do arquivo se ainda há uso deles; se não houver, removê-los da linha de import:

```tsx
import {
  CloudUpload, FileText, Download, CheckCircle, CheckCircle2,
  Loader2, AlertTriangle, DollarSign, MessageSquare, History,
  ChevronRight, FileCode2, Bell, Send, CalendarClock,
  Landmark, Receipt, Calculator, Users as UsersIcon, FolderOpen, X,
  AlertCircle, Clock
} from 'lucide-react';
```

Após verificar que `History`, `MessageSquare`, `ChevronRight` e `AlertCircle` não aparecem mais no JSX, remover somente os que não tiverem uso restante. `Clock` ainda é usado em outros lugares — não remover.

- [ ] **Step 5: Verificar type-check**

```bash
npm run type-check
```

Esperado: zero erros. Se houver erros de "X is declared but never used", remover os imports correspondentes.

- [ ] **Step 6: Commit**

```bash
git add app/\(cliente\)/inicio/page.tsx
git commit -m "refactor(inicio): two-column layout, compact upload sidebar, remove quick actions"
```

---

## Verificação Final

- [ ] Rodar `npm run dev:tunnel` (ou `npm run dev`) e abrir `http://localhost:4500/inicio`
- [ ] Desktop (> 1024px): saudação + 4 mini-stats em linha; corpo em 2 colunas (docs esquerda, upload direita)
- [ ] Mobile (< 768px): saudação em cima, stats em grid 2×2, upload e docs empilhados
- [ ] Clicar em cada um dos 6 cards de upload — modal de envio abre corretamente
- [ ] Modo escuro: verificar que mini-stats e cards de upload renderizam bem
- [ ] Confirmar que "Ações Rápidas" sumiu completamente
- [ ] Confirmar que o grid antigo de 4 stat cards sumiu
