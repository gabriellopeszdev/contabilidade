# UX, Acessibilidade e Consistência Visual — Design Spec

> **Para agentes:** Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tela por tela.

**Goal:** Corrigir problemas de acessibilidade, consistência visual, mobile e feedback em todas as telas principais do FiscoHub, tela por tela em ordem de impacto.

**Arquitetura:** Abordagem por tela (Approach C) — cada tela recebe um PR isolado com todos os fixes de UX, acessibilidade, consistência e mobile juntos. Sem refatorações estruturais; apenas correções cirúrgicas nos arquivos existentes.

**Tech Stack:** Next.js 16, React 18, Tailwind CSS 3, Lucide React, Sonner (toasts)

---

## Ordem de implementação

| # | Tela / Arquivo | Motivo |
|---|---------------|--------|
| 1 | `app/(contador)/layout.tsx` | Afeta todas as 10+ páginas do contador |
| 2 | `app/login/page.tsx` | Primeiro contato de todos os usuários |
| 3 | `app/(contador)/clientes/page.tsx` | Tela mais usada pelo contador |
| 4 | `app/(cliente)/layout.tsx` | Afeta todas as páginas do cliente |
| 5 | `app/auth/ativar-conta/page.tsx` | Onboarding crítico |
| 6 | `app/(contador)/calendario/page.tsx` | Funcionalidade central |
| 7 | `src/presentation/components/cliente/ClienteModal.tsx` | Usado em múltiplas telas |
| 8 | `src/presentation/components/dashboard/DashboardContadorDono.tsx` | Tela de entrada |

---

## Fixes por tela

### Tela 1 — Layout do Contador (`app/(contador)/layout.tsx`)

**Acessibilidade:**
- Adicionar skip link no topo: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Ir para o conteúdo</a>`
- Adicionar `id="main-content"` no `<main>`
- Dropdowns de notificações e usuário: adicionar `aria-expanded={aberto}` e `aria-haspopup="true"` nos botões que os disparam
- Botões de ícone isolados (tema dark/light, fechar sidebar): adicionar `aria-label` descritivo
- Itens de nav bloqueados por plano: adicionar `aria-disabled="true"` junto ao `title` existente

**Consistência visual:**
- Item ativo do menu: substituir `bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300` por `bg-primary/10 text-primary` — alinha com o token `primary` usado no resto do sistema

**Mobile (touch targets):**
- Botão hambúrguer, notificações e tema: de `p-2` para `p-2.5` com `min-h-[44px] min-w-[44px] flex items-center justify-center`

---

### Tela 2 — Login (`app/login/page.tsx`)

**Acessibilidade:**
- Inputs de e-mail e senha: garantir que cada `<input>` tenha `id` único e `<label htmlFor={id}>` associado
- Inputs de código 2FA: adicionar `<label className="sr-only">` se não tiver label visível
- Link "Esqueci minha senha": adicionar `aria-label="Recuperar senha por e-mail"`
- Links externos com `target="_blank"`: adicionar `aria-label="... (abre em nova aba)"` e `rel="noopener noreferrer"`
- Elemento de erro: adicionar `tabIndex={-1}` e `ref`, chamar `.focus()` quando o erro aparecer

**Consistência visual:**
- Botão principal: substituir classe utilitária `btn-primary` por `bg-primary text-white hover:brightness-90 ...` (padrão Tailwind explícito usado no resto do sistema)
- Inputs: substituir classe utilitária `input` por `w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow`

---

### Tela 3 — Clientes (`app/(contador)/clientes/page.tsx`)

**Acessibilidade:**
- Input de busca: adicionar `<label htmlFor="busca-clientes" className="sr-only">Buscar clientes</label>` e `id="busca-clientes"` no input
- Modal de exclusão: adicionar `role="dialog" aria-modal="true" aria-labelledby="modal-excluir-titulo"` no container e `id="modal-excluir-titulo"` no `<h2>`
- Lista de clientes: converter `<ul role="list">` + `<li>` + divs para `<table>` semântico com `<thead>`, `<tbody>`, `<tr>`, `<th scope="col">`, `<td>`

**Mobile:**
- Container da tabela: envolver em `<div className="overflow-x-auto">` para scroll horizontal em telas pequenas
- Botões de ação (lixeira, editar, ver, reenviar): de `p-2` para `p-2 min-h-[44px] min-w-[44px] flex items-center justify-center`

**Feedback:**
- Estado de erro: adicionar botão `<button onClick={() => mutate()}>Tentar novamente</button>` abaixo da mensagem de erro
- Estado vazio (sem busca): adicionar botão "Novo Cliente" diretamente no card vazio como call-to-action secundário

---

### Tela 4 — Layout do Cliente (`app/(cliente)/layout.tsx`)

**Acessibilidade:**
- Mesmos fixes do layout do contador: skip link, `id="main-content"`, `aria-expanded`, `aria-label` nos botões de ícone

**Consistência visual:**
- Cor de item ativo: substituir `bg-sky-50 dark:bg-sky-900/20 text-sky-700` por `bg-primary/10 text-primary` — unifica com o layout do contador

**Mobile:**
- Mesmos fixes de touch target (44px mínimo) nos botões da topbar

---

### Tela 5 — Ativar Conta (`app/auth/ativar-conta/page.tsx`)

**Acessibilidade:**
- Inputs: adicionar `id="senha"` e `id="confirmar-senha"` (já têm `htmlFor` nos labels — só faltam os `id` correspondentes confirmados)
- Botão de toggle de senha: manter `tabIndex={-1}` (correto — toggle não é ação primária), mas adicionar `aria-label="Mostrar senha"` / `"Ocultar senha"` dinâmico
- Inputs de senha: adicionar `minLength={8}` explícito

**Consistência visual:**
- Botão "Ativar Conta": substituir `bg-blue-600 hover:bg-blue-700` por `bg-primary hover:brightness-90` — alinha com o padrão do sistema

---

### Tela 6 — Calendário (`app/(contador)/calendario/page.tsx`)

**Acessibilidade:**
- Células do calendário: adicionar `aria-label="Dia {número}, {mês}"` em cada botão de dia
- Células de mês anterior/próximo com `disabled`: adicionar `aria-disabled="true"`
- Cores de urgência (vermelho/amarelo): garantir que haja texto alternativo além da cor (já existem textos como "Urgente" — verificar se estão visíveis para leitores de tela)
- Botões "Sim/Não" de confirmação de delete inline: aumentar área de toque para 44px

**Consistência visual:**
- Cores de status hardcoded (`#ef4444`): substituir por `text-red-500` / `bg-red-500` — alinha com o Tailwind do restante

**Mobile:**
- Grid do calendário (`grid-cols-7`): adicionar `text-xs` nas células em mobile (`sm:text-sm`) e reduzir `h-20` para `h-14 sm:h-20`
- Sidebar lateral: garantir que em mobile apareça como drawer ou seção colapsável, não desapareça silenciosamente

---

### Tela 7 — ClienteModal (`src/presentation/components/cliente/ClienteModal.tsx`)

**Acessibilidade:**
- `role="dialog"`: adicionar `aria-labelledby` apontando para o `<h2>` do título do modal
- Inputs com erro: adicionar `aria-invalid={!!erro}` e `aria-describedby` apontando para o `<p>` de erro
- Input de cor (`type="color"`): adicionar `<label htmlFor="cor-cliente">Cor de identificação</label>`
- Foco inicial: garantir que ao abrir o modal o foco vai para o primeiro input (já tem tentativa com timeout — tornar mais robusto com `autoFocus` no input)

**Consistência visual:**
- Labels de campos obrigatórios: o `*` vermelho já existe — garantir que haja também `aria-required="true"` no input correspondente
- Espaçamentos: padronizar todos os grupos de campo para `space-y-1.5` (label + input) consistente com o resto do sistema

---

### Tela 8 — Dashboard do Contador (`src/presentation/components/dashboard/DashboardContadorDono.tsx`)

**Acessibilidade:**
- `MetricCard`: adicionar `aria-label` descritivo combinando título + valor (ex: `aria-label="Clientes ativos: 12"`)
- Botões de `QuickAction`: adicionar `aria-label` descritivo (ex: `aria-label="Ir para upload de documentos"`)
- Ícones de urgência em `ObrigacoesCriticasWidget`: adicionar `aria-label` nos ícones de alerta

**Consistência visual:**
- `bg-primary-50`: verificar se essa classe está definida no `tailwind.config.ts`; se não estiver, substituir por `bg-primary/5`
- Cores de `MetricCard` via props: documentar as cores aceitas para evitar variações não padronizadas

**Mobile:**
- Grid de QuickActions: garantir que em mobile fique em 2 colunas (`grid-cols-2`) em vez de 4, evitando botões muito estreitos
- Activity feed: em mobile, colapsar em seção expansível em vez de desaparecer

---

## Critérios de aceitação (por tela)

Cada tela está completa quando:
1. Nenhum botão interativo tem área de toque < 44×44px
2. Todos os inputs têm `id` e `<label htmlFor>` associados
3. Todos os botões de ícone têm `aria-label`
4. Dropdowns têm `aria-expanded` correto
5. Cores primárias usam token `primary` (não `blue-600` ou `sky-600`)
6. Estados de erro têm botão de retry ou instrução clara
7. Modais têm `role="dialog" aria-modal="true" aria-labelledby`
