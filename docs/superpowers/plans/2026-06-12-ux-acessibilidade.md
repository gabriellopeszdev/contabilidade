# UX, Acessibilidade e Consistência Visual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir problemas de acessibilidade, consistência visual, mobile e feedback nas 8 telas principais do FiscoHub, tela por tela.

**Architecture:** Correções cirúrgicas por arquivo — sem refatorações estruturais. Cada task cobre um arquivo completo com todos os fixes de acessibilidade (aria-*), consistência visual (tokens primary), mobile (touch targets 44px) e feedback (retry, foco em erro).

**Tech Stack:** Next.js 16, React 18, Tailwind CSS 3, Lucide React, Sonner

---

## Arquivos modificados

- Modify: `app/(contador)/layout.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/(contador)/clientes/page.tsx`
- Modify: `app/(cliente)/layout.tsx`
- Modify: `app/auth/ativar-conta/page.tsx`
- Modify: `app/(contador)/calendario/page.tsx`
- Modify: `src/presentation/components/cliente/ClienteModal.tsx`
- Modify: `src/presentation/components/dashboard/DashboardContadorDono.tsx`

---

## Task 1: Layout do Contador

**Contexto:** `app/(contador)/layout.tsx` é o shell de todas as 10+ páginas do contador. Fixes aqui beneficiam todo o módulo de uma vez.

**Files:**
- Modify: `app/(contador)/layout.tsx`

### O que mudar e onde

**1. Skip link — antes do `<div className="flex h-screen ...">` (início do return)**

- [ ] Adicionar skip link acessível logo antes da div raiz do layout:

```tsx
{/* Skip link para teclado — visível apenas em foco */}
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
>
  Ir para o conteúdo principal
</a>
```

**2. `<main>` — adicionar `id="main-content"`**

- [ ] Localizar a linha `<main className="flex-1 overflow-y-auto">` e adicionar o id:

```tsx
<main id="main-content" className="flex-1 overflow-y-auto">
```

**3. Itens de navegação bloqueados — adicionar `aria-disabled`**

- [ ] Localizar o bloco `if (bloqueado)` que renderiza o `<div>` bloqueado e adicionar `aria-disabled="true"`:

```tsx
<div
  key={item.href}
  title={title}
  aria-disabled="true"
  role="link"
  className={`
    flex items-center rounded-lg text-sm font-medium cursor-not-allowed opacity-50
    ${colapsada ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'}
    text-gray-400 dark:text-gray-600
  `}
>
```

**4. Link ativo — padronizar cor para token `primary`**

- [ ] Localizar o className do `<Link>` ativo no nav e substituir as classes de cor azul:

```tsx
// DE:
? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
// PARA:
? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
```

- [ ] Localizar o `<span>` do ícone dentro do Link ativo e substituir a cor:

```tsx
// DE:
<span className={`shrink-0 ${ativo ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
// PARA:
<span className={`shrink-0 ${ativo ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
```

**5. Botão hambúrguer (mobile) — touch target 44px + aria-label**

- [ ] Localizar o botão com `aria-label="Abrir menu"` e aumentar área de toque:

```tsx
<button
  className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
  onClick={() => setSidebarAberta(true)}
  aria-label="Abrir menu de navegação"
>
  <Menu size={20} />
</button>
```

**6. Botão toggle sidebar (desktop) — aria-label**

- [ ] Localizar o botão `onClick={toggleColapsada}` e adicionar aria-label dinâmico:

```tsx
<button
  onClick={toggleColapsada}
  aria-label={colapsada ? 'Expandir sidebar' : 'Recolher sidebar'}
  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
>
  {colapsada ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
</button>
```

**7. Botão Ajuda — aria-label + touch target**

- [ ] Localizar o botão `onClick={() => setHelpAberto(true)}`:

```tsx
<button
  onClick={() => setHelpAberto(true)}
  aria-label="Ajuda e tutoriais"
  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
>
  <HelpCircle size={18} />
</button>
```

**8. Botão Dark Mode — aria-label + touch target**

- [ ] Localizar o botão `onClick={toggleDark}`:

```tsx
<button
  onClick={toggleDark}
  aria-label={dark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
>
  {dark ? <Sun size={18} /> : <Moon size={18} />}
</button>
```

**9. Botão Notificações — aria-expanded + touch target**

- [ ] Localizar o botão de notificações e adicionar `aria-expanded` e touch target:

```tsx
<button
  onClick={() => setNotifAberto((v) => !v)}
  aria-expanded={notifAberto}
  aria-haspopup="true"
  aria-label={`Notificações${naoLidas > 0 ? ` — ${naoLidas} não lidas` : ''}`}
  className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
>
  <Bell size={18} />
  {naoLidas > 0 && (
    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
      {naoLidas > 99 ? '99+' : naoLidas}
    </span>
  )}
</button>
```

**10. Botão usuário — aria-expanded**

- [ ] Localizar o botão `onClick={() => setUserMenuAberto((v) => !v)}` e adicionar:

```tsx
<button
  onClick={() => setUserMenuAberto((v) => !v)}
  aria-expanded={userMenuAberto}
  aria-haspopup="true"
  aria-label={`Menu do usuário — ${usuario.nome}`}
  className="flex items-center gap-2 pl-2 pr-3 min-h-[44px] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
>
```

- [ ] Commit:

```bash
git add "app/(contador)/layout.tsx"
git commit -m "fix(a11y): skip link, aria-expanded, aria-label e touch targets no layout do contador"
```

---

## Task 2: Login

**Contexto:** `app/login/page.tsx` — primeiro contato de todos os usuários. As classes `btn-primary` e `input` já estão definidas em `app/globals.css` com `bg-primary`, então estão corretas. Os fixes são de acessibilidade: foco em erro e labels em links externos.

**Files:**
- Modify: `app/login/page.tsx`

### O que mudar e onde

**1. Importar `useRef` — já pode estar importado, verificar**

- [ ] Garantir que `useRef` está no import do React:

```tsx
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
```

**2. Criar ref para o alerta de erro e movê-lo para foco automático**

- [ ] Após as declarações de state, adicionar:

```tsx
const erroRef = useRef<HTMLParagraphElement>(null);
```

- [ ] Adicionar `useEffect` que move foco para o erro quando ele aparece:

```tsx
useEffect(() => {
  if (erro && erroRef.current) {
    erroRef.current.focus();
  }
}, [erro]);
```

**3. Adicionar `tabIndex` e `ref` ao componente de erro**

- [ ] Localizar o `ErroAlert` e adicionar `ref` e `tabIndex`:

```tsx
const ErroAlert = erro ? (
  <p
    ref={erroRef}
    role="alert"
    tabIndex={-1}
    className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
               rounded-xl px-3 py-2 leading-snug focus:outline-none"
  >
    {erro}
  </p>
) : null;
```

**4. Link "Esqueci minha senha" — aria-label**

- [ ] Localizar o `<a href="/auth/recuperar-senha">` e adicionar:

```tsx
<a
  href="/auth/recuperar-senha"
  aria-label="Recuperar senha por e-mail"
  className="text-xs text-blue-600 hover:underline"
>
  Esqueci minha senha
</a>
```

**5. Links externos (Privacidade e Termos) — aria-label com aviso de nova aba**

- [ ] Localizar os dois links `target="_blank"` e adicionar aria-label:

```tsx
<a
  href="/privacidade"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Política de Privacidade (abre em nova aba)"
  className="hover:text-slate-600 transition-colors"
>
  Política de Privacidade
</a>
<span aria-hidden="true">|</span>
<a
  href="/termos"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Termos de Uso (abre em nova aba)"
  className="hover:text-slate-600 transition-colors"
>
  Termos de Uso
</a>
```

- [ ] Commit:

```bash
git add "app/login/page.tsx"
git commit -m "fix(a11y): foco automático em erro e aria-labels no login"
```

---

## Task 3: Clientes

**Contexto:** `app/(contador)/clientes/page.tsx` — tela mais usada pelo contador. Recebe `<table>` semântico, scroll horizontal mobile, retry no erro, call-to-action no estado vazio e aria no modal de exclusão.

**Files:**
- Modify: `app/(contador)/clientes/page.tsx`

### O que mudar e onde

**1. Label sr-only no input de busca**

- [ ] Localizar o bloco da barra de busca e adicionar label oculto + id no input:

```tsx
<div className="mb-5">
  <div className="relative max-w-md">
    <label htmlFor="busca-clientes" className="sr-only">Buscar clientes</label>
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      id="busca-clientes"
      type="text"
      value={busca}
      onChange={(e) => setBusca(e.target.value)}
      placeholder="Buscar por nome, CNPJ ou e-mail…"
      className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-gray-800
        text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500
        focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
    />
  </div>
</div>
```

**2. Estado de erro — adicionar botão "Tentar novamente"**

- [ ] Localizar o bloco de erro e adicionar o botão de retry:

```tsx
{error ? (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
    <AlertCircle size={28} className="text-red-400" />
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Falha ao carregar clientes</p>
    <p className="text-xs text-slate-500 dark:text-slate-400">{error.message}</p>
    <button
      type="button"
      onClick={() => mutate()}
      className="mt-2 px-4 py-2 text-sm font-semibold text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
    >
      Tentar novamente
    </button>
  </div>
```

**3. Estado vazio (sem busca) — adicionar botão Novo Cliente**

- [ ] Localizar o bloco `clientes.length === 0` e adicionar call-to-action quando não há filtro:

```tsx
) : clientes.length === 0 ? (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center gap-3 text-center">
    <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 dark:bg-gray-800">
      <Users size={24} className="text-slate-400 dark:text-slate-500" />
    </div>
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
      {buscaDebounced ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
    </p>
    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
      {buscaDebounced
        ? 'Tente uma busca diferente.'
        : 'Cadastre o primeiro cliente da sua carteira.'}
    </p>
    {!buscaDebounced && (
      <button
        type="button"
        onClick={abrirCriar}
        className="mt-1 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:brightness-90 transition-all"
      >
        <Plus size={15} />
        Novo Cliente
      </button>
    )}
  </div>
```

**4. Tabela semântica com overflow-x-auto**

- [ ] Substituir o bloco `<div className="bg-white ...">` que contém o header e a `<ul>` por uma estrutura de `<table>` semântica. Substituir:

```tsx
{/* Tabela */}
<div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
  {/* Header da tabela */}
  <div className="hidden sm:grid sm:grid-cols-[1fr_180px_200px_120px_130px] gap-4 px-5 py-3
    border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
    <span>Cliente</span>
    <span>CNPJ</span>
    <span>E-mail</span>
    <span>Desde</span>
    <span className="text-right">Ações</span>
  </div>

  {/* Linhas */}
  <ul role="list" className="divide-y divide-slate-100 dark:divide-gray-700">
    {clientes.map((c) => (
      <li key={c.id} className="group">
        <div className="sm:grid sm:grid-cols-[1fr_180px_200px_120px_130px] gap-4 items-center
          px-5 py-4 hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
          {/* ... conteúdo das células ... */}
        </div>
      </li>
    ))}
  </ul>
```

Por:

```tsx
{/* Tabela semântica com scroll horizontal em mobile */}
<div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full min-w-[640px]">
      <thead className="bg-slate-50 dark:bg-gray-800 border-b border-slate-100 dark:border-gray-700">
        <tr>
          <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cliente</th>
          <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[180px]">CNPJ</th>
          <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[200px]">E-mail</th>
          <th scope="col" className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[120px]">Desde</th>
          <th scope="col" className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-[130px]">Ações</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
        {clientes.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
            {/* Avatar + Nome */}
            <td className="px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400
                  flex items-center justify-center text-xs font-bold">
                  {iniciais(c.nome)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => router.push(`/clientes/${c.id}`)}
                      className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate hover:text-primary transition-colors text-left"
                    >
                      {c.nome}
                    </button>
                    {c.activatedAt === null ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px]
                        font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Pendente
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px]
                        font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Ativo
                      </span>
                    )}
                  </div>
                  {c.phone && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone size={10} /> {c.phone}
                    </p>
                  )}
                </div>
              </div>
            </td>
            {/* CNPJ */}
            <td className="px-5 py-4">
              <div className="flex items-center gap-1.5">
                <Building2 size={12} className="text-slate-400 shrink-0" />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-mono">{formatarCNPJ(c.cnpj)}</span>
              </div>
            </td>
            {/* E-mail */}
            <td className="px-5 py-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <Mail size={12} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-600 dark:text-slate-400 truncate">{c.email}</span>
              </div>
            </td>
            {/* Desde */}
            <td className="px-5 py-4">
              <span className="text-xs text-slate-500 dark:text-slate-400">{formatarData(c.createdAt)}</span>
            </td>
            {/* Ações */}
            <td className="px-5 py-4">
              <div className="flex items-center justify-end gap-1">
                {c.activatedAt === null && (
                  <button
                    type="button"
                    onClick={() => handleReenviarConvite(c)}
                    disabled={reenviando === c.id}
                    aria-label={`Reenviar convite para ${c.nome}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50"
                  >
                    {reenviando === c.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/clientes/${c.id}`)}
                  aria-label={`Ver prontuário de ${c.nome}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  <Eye size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => abrirEditar(c)}
                  aria-label={`Editar ${c.nome}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleExcluir(c)}
                  disabled={excluindo === c.id}
                  aria-label={`Remover ${c.nome}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  {excluindo === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
```

**5. Modal de exclusão — aria-modal + aria-labelledby**

- [ ] Localizar a div raiz do modal de exclusão (`{clienteParaExcluir && (`) e adicionar atributos:

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-excluir-titulo"
  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
  onClick={() => setClienteParaExcluir(null)}
>
```

- [ ] Adicionar `id` no `<h2>` do modal:

```tsx
<h2 id="modal-excluir-titulo" className="text-base font-bold text-gray-900 dark:text-gray-100">Remover cliente</h2>
```

- [ ] Commit:

```bash
git add "app/(contador)/clientes/page.tsx"
git commit -m "fix(a11y): tabela semântica, touch targets, aria-modal e retry no erro em clientes"
```

---

## Task 4: Layout do Cliente

**Contexto:** `app/(cliente)/layout.tsx` — shell do portal do cliente. Mesmos padrões do layout do contador: skip link, aria-expanded, aria-label, touch targets e cor de item ativo unificada com `primary`.

**Files:**
- Modify: `app/(cliente)/layout.tsx`

### O que mudar e onde

**1. Skip link — antes do `<div className="flex h-screen ...">` (início do return)**

- [ ] Adicionar skip link igual ao do layout do contador:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
>
  Ir para o conteúdo principal
</a>
```

**2. `<main>` — adicionar `id="main-content"`**

- [ ] Localizar o elemento `<main>` do layout e adicionar o id. Se não existir `<main>`, envolver o `{children}` com um:

```tsx
<main id="main-content" className="flex-1 overflow-y-auto">
  {children}
</main>
```

**3. Link ativo — padronizar cor para `primary`**

- [ ] Localizar o className do Link ativo no nav e substituir `sky-`:

```tsx
// DE:
? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
// PARA:
? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
```

- [ ] Localizar o ícone dentro do Link ativo e substituir:

```tsx
// DE:
<span className={`shrink-0 ${ativo ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400 dark:text-gray-500'}`}>
// PARA:
<span className={`shrink-0 ${ativo ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}`}>
```

**4. Botão fechar sidebar mobile — aria-label + touch target**

- [ ] Localizar o botão `<X size={18} />` dentro da sidebar e adicionar:

```tsx
<button
  aria-label="Fechar menu de navegação"
  className="ml-auto lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
  onClick={() => setSidebarAberta(false)}
>
  <X size={18} />
</button>
```

**5. Botão hambúrguer mobile (topbar) — aria-label + touch target**

- [ ] Localizar o botão que abre a sidebar no mobile e adicionar:

```tsx
<button
  aria-label="Abrir menu de navegação"
  className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
  onClick={() => setSidebarAberta(true)}
>
  <Menu size={20} />
</button>
```

- [ ] Commit:

```bash
git add "app/(cliente)/layout.tsx"
git commit -m "fix(a11y): skip link, aria-expanded, cor primary e touch targets no layout do cliente"
```

---

## Task 5: Ativar Conta

**Contexto:** `app/auth/ativar-conta/page.tsx` — página de onboarding do cliente. Fixes: cor do botão para `primary`, aria-label dinâmico no toggle de senha, minLength explícito.

**Files:**
- Modify: `app/auth/ativar-conta/page.tsx`

### O que mudar e onde

**1. Botão "Ativar Conta" — cor para `primary`**

- [ ] Localizar o botão de submit e substituir `bg-blue-600 hover:bg-blue-700` por `bg-primary hover:brightness-90`:

```tsx
<button
  type="submit"
  disabled={carregando}
  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5
             text-sm font-semibold text-white shadow-sm hover:brightness-90 disabled:opacity-50
             disabled:cursor-not-allowed transition-colors focus-visible:outline-none
             focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
>
  {carregando ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
  {carregando ? 'Ativando…' : 'Ativar Conta'}
</button>
```

**2. Botão toggle de senha — aria-label dinâmico**

- [ ] Localizar o botão `<EyeOff>` / `<Eye>` dentro do input de senha e adicionar:

```tsx
<button
  type="button"
  onClick={() => setMostrarSenha((v) => !v)}
  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
  tabIndex={-1}
>
  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
</button>
```

**3. Inputs de senha — adicionar `minLength`**

- [ ] Localizar o `<input id="senha">` e adicionar `minLength={8}`:

```tsx
<input
  id="senha"
  type={mostrarSenha ? 'text' : 'password'}
  value={senha}
  onChange={(e) => setSenha(e.target.value)}
  minLength={8}
  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900
             placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary
             focus:border-transparent transition-shadow"
  placeholder="Mínimo 8 caracteres"
  autoComplete="new-password"
/>
```

- [ ] Commit:

```bash
git add "app/auth/ativar-conta/page.tsx"
git commit -m "fix(a11y): cor primary, aria-label no toggle de senha e minLength em ativar-conta"
```

---

## Task 6: Calendário

**Contexto:** `app/(contador)/calendario/page.tsx` — leitura necessária antes de editar pois é arquivo grande. Os fixes são: aria-label nos botões de dia, aria-disabled em dias fora do mês, cores hardcoded para tokens Tailwind e tamanho responsivo das células.

**Files:**
- Modify: `app/(contador)/calendario/page.tsx`

### O que mudar e onde

Antes de editar, ler o arquivo para identificar as linhas exatas:

- [ ] Ler `app/(contador)/calendario/page.tsx` completo para localizar:
  - O `map` que renderiza células do calendário (`cell.dia`, `cell.mesAtual`)
  - As cores hardcoded como `#ef4444`, `'#f59e0b'` etc
  - Os botões de "Sim/Não" de confirmação de delete inline
  - O grid `grid-cols-7` e células com `h-20`

**1. Células do calendário — aria-label + aria-disabled**

- [ ] No `map` de células, ao renderizar cada botão de dia, adicionar aria-label e aria-disabled:

```tsx
<button
  type="button"
  aria-label={`${cell.dia} de ${MESES[mesAtual]} de ${anoAtual}`}
  aria-disabled={!cell.mesAtual || undefined}
  disabled={!cell.mesAtual}
  onClick={() => cell.mesAtual && handleDiaSelecionado(cell)}
  className={`h-14 sm:h-20 w-full text-left p-1 text-xs sm:text-sm ...`}
>
```

**2. Cores hardcoded — substituir por tokens Tailwind**

- [ ] Buscar e substituir todas as ocorrências de cores inline como `style={{ color: '#ef4444' }}` por classes Tailwind:
  - `#ef4444` → `text-red-500` / `bg-red-500`
  - `#f59e0b` → `text-amber-500` / `bg-amber-500`
  - `#10b981` → `text-emerald-500` / `bg-emerald-500`
  - `#3b82f6` → `text-blue-500` / `bg-blue-500`

**3. Grid responsivo das células — altura menor em mobile**

- [ ] Localizar `h-20` nas células do calendário e adicionar breakpoint:

```
h-14 sm:h-20
```

- [ ] Localizar `text-xs` nas células e garantir que em mobile também seja `text-xs sm:text-sm`

**4. Botões Sim/Não de delete — touch target 44px**

- [ ] Localizar os botões de confirmação inline de exclusão de obrigação e ajustar:

```tsx
<button
  type="button"
  onClick={confirmarDelete}
  className="min-h-[44px] px-3 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
>
  Sim
</button>
<button
  type="button"
  onClick={cancelarDelete}
  className="min-h-[44px] px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
>
  Não
</button>
```

- [ ] Commit:

```bash
git add "app/(contador)/calendario/page.tsx"
git commit -m "fix(a11y): aria-label em células, cores Tailwind e touch targets no calendário"
```

---

## Task 7: ClienteModal

**Contexto:** `src/presentation/components/cliente/ClienteModal.tsx` — modal de criar/editar cliente, usado em múltiplas telas. Fixes: aria-labelledby no dialog, aria-invalid + aria-describedby em inputs com erro, aria-required, label no input de cor.

**Files:**
- Modify: `src/presentation/components/cliente/ClienteModal.tsx`

### O que mudar e onde

Antes de editar, ler o arquivo para localizar as linhas exatas do `role="dialog"`, do `<h2>` título e dos inputs com mensagens de erro.

- [ ] Ler `src/presentation/components/cliente/ClienteModal.tsx` para identificar:
  - A div com `role="dialog"` (ou onde o modal é renderizado)
  - O `<h2>` com o título do modal
  - Os inputs de nome, email, CNPJ, phone e seus erros

**1. Dialog — aria-labelledby**

- [ ] Localizar o container do modal com `role="dialog"` e adicionar:

```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-cliente-titulo"
  ...
>
```

- [ ] Adicionar `id` no `<h2>` do título:

```tsx
<h2 id="modal-cliente-titulo" className="...">
  {dadosIniciais ? 'Editar Cliente' : 'Novo Cliente'}
</h2>
```

**2. Inputs com erro — aria-invalid + aria-describedby**

- [ ] Para cada campo com validação (nome, email, cnpj), adicionar no `<input>`:

```tsx
<input
  id="campo-nome"
  aria-invalid={!!erroNome}
  aria-describedby={erroNome ? 'erro-nome' : undefined}
  ...
/>
{erroNome && (
  <p id="erro-nome" className="text-xs text-red-600 mt-1">{erroNome}</p>
)}
```

**3. Inputs obrigatórios — aria-required**

- [ ] Adicionar `aria-required="true"` nos inputs de nome, email e CNPJ (que já têm `*` visual):

```tsx
<input
  id="campo-nome"
  aria-required="true"
  aria-invalid={!!erroNome}
  ...
/>
```

**4. Input de cor — label acessível**

- [ ] Localizar o `<input type="color">` e garantir que tem `id` e `<label htmlFor>`:

```tsx
<label htmlFor="cor-cliente" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
  Cor de identificação
</label>
<input
  id="cor-cliente"
  type="color"
  ...
/>
```

**5. autoFocus no primeiro input**

- [ ] Remover o `setTimeout` de foco e usar `autoFocus` diretamente no primeiro input do modal:

```tsx
<input
  id="campo-nome"
  autoFocus
  aria-required="true"
  ...
/>
```

- [ ] Commit:

```bash
git add "src/presentation/components/cliente/ClienteModal.tsx"
git commit -m "fix(a11y): aria-labelledby, aria-invalid, aria-required e autoFocus no ClienteModal"
```

---

## Task 8: Dashboard do Contador

**Contexto:** `src/presentation/components/dashboard/DashboardContadorDono.tsx` — tela de entrada após login. Fixes: aria-label em MetricCard e QuickAction, grid responsivo em mobile, ícones com aria-label.

**Files:**
- Modify: `src/presentation/components/dashboard/DashboardContadorDono.tsx`

### O que mudar e onde

Antes de editar, ler o arquivo para localizar as linhas exatas dos componentes internos.

- [ ] Ler `src/presentation/components/dashboard/DashboardContadorDono.tsx` para identificar:
  - O componente `MetricCard` e onde é chamado com `titulo` e `valor`
  - O componente `QuickAction` e suas props de `label` e `href`/`onClick`
  - Os ícones de urgência em `ObrigacoesCriticasWidget`
  - O grid de QuickActions e o grid principal

**1. MetricCard — aria-label composto**

- [ ] Localizar a definição do componente `MetricCard` e adicionar `aria-label` no container:

```tsx
function MetricCard({ titulo, valor, ... }: MetricCardProps) {
  return (
    <div
      aria-label={`${titulo}: ${valor}`}
      className="..."
    >
      ...
    </div>
  );
}
```

**2. QuickAction — aria-label descritivo**

- [ ] Localizar o componente `QuickAction` e garantir que o botão/link tem `aria-label`:

```tsx
function QuickAction({ label, href, onClick, icone, cor }: QuickActionProps) {
  const className = '...';
  return href ? (
    <Link href={href} aria-label={label} className={className}>
      {icone}
      <span>{label}</span>
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {icone}
      <span>{label}</span>
    </button>
  );
}
```

**3. Grid de QuickActions — 2 colunas em mobile**

- [ ] Localizar o grid que renderiza os QuickActions e garantir `grid-cols-2` em mobile:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
  {/* QuickActions */}
</div>
```

**4. Ícones de urgência — aria-label**

- [ ] Localizar os ícones usados em `ObrigacoesCriticasWidget` para indicar urgência (ex: `<AlertCircle>`, `<Clock>`) e adicionar `aria-label`:

```tsx
<AlertCircle size={14} aria-label="Urgente" className="text-red-500" />
```

**5. Verificar `bg-primary-50`**

- [ ] Buscar todas as ocorrências de `bg-primary-50` no arquivo:

```bash
grep -n "primary-50" src/presentation/components/dashboard/DashboardContadorDono.tsx
```

- [ ] Se encontrar, substituir por `bg-primary/5` (forma correta com Tailwind opacity modifier):

```
bg-primary-50  →  bg-primary/5
```

- [ ] Commit:

```bash
git add "src/presentation/components/dashboard/DashboardContadorDono.tsx"
git commit -m "fix(a11y): aria-label em MetricCard/QuickAction, grid responsivo e cor primary no dashboard"
```

---

## Critérios de aceitação globais

Após todas as tasks, verificar em cada tela:

- [ ] Nenhum botão interativo tem área de toque < 44×44px
- [ ] Todos os inputs têm `id` e `<label htmlFor>` associados
- [ ] Todos os botões de ícone têm `aria-label`
- [ ] Dropdowns têm `aria-expanded` correto
- [ ] Cores primárias usam token `primary` (não `blue-600` nem `sky-600`)
- [ ] Estados de erro têm botão de retry ou instrução clara
- [ ] Modais têm `role="dialog" aria-modal="true" aria-labelledby`
- [ ] Layouts têm skip link e `id="main-content"` no `<main>`
