# Redesign da Página /inicio (Portal do Cliente) — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesenhar a página `/inicio` do portal do cliente para ter hierarquia visual clara, com foco em documentos recebidos do contador e upload compacto acessível na lateral.

**Abordagem:** Layout de duas colunas no desktop — coluna principal (60%) com documentos do contador + alertas, coluna secundária (40%) com cards de upload compactos. Stats movidos para linha do header (ao lado da saudação). Remoção da seção "Ações Rápidas" redundante.

**Arquivo afetado:** `app/(cliente)/inicio/page.tsx` (único arquivo modificado)

---

## Seção 1 — Topo: Saudação + Stats em linha

### Layout atual (problema)
- Saudação ocupa linha inteira
- 4 stat cards ficam numa segunda linha separada, soltos e grandes
- Muito espaço vertical desperdiçado antes do conteúdo principal

### Layout novo
- Saudação ("Boa noite, Gabriel" + data) fica à esquerda
- 4 mini-stats ficam à direita na mesma linha, em `flex items-center gap-3`
- Cada mini-stat: container ~72px de altura com ícone pequeno (16px) + valor em negrito + label em texto menor
- Quando stat tem dado crítico (boleto vencido, doc novo): fundo colorido sutil + texto na cor correspondente

### Especificação dos mini-stats (da esquerda para direita)
1. **Novos docs do contador** — ícone `Bell`, valor = `novosDoContador`, cor azul (primary) quando > 0
2. **Boletos em aberto** — ícone `DollarSign`, valor = `formatarMoeda(valorAberto)` ou "R$ 0", cor vermelha se vencidos, âmbar se em aberto, cinza se zerado
3. **Enviados este mês** — ícone `Send`, valor = `enviadosMes`, sempre cinza
4. **Próximo vencimento** — ícone `CalendarClock`, valor = dias ou "—", cor âmbar se ≤ 5 dias

### Responsividade do topo
- `lg+`: saudação + stats em uma linha (`flex items-end justify-between`)
- `md` e abaixo: saudação em cima, stats em grid `grid-cols-2 sm:grid-cols-4` abaixo

---

## Seção 2 — Corpo: Duas Colunas

### Estrutura
```
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  <section className="lg:col-span-3">  {/* Coluna esquerda — Documentos do Contador */}
  <aside   className="lg:col-span-2">  {/* Coluna direita — Upload */}
```

Proporção: 3/5 esquerda, 2/5 direita (equivale a 60/40).

---

## Seção 3 — Coluna Esquerda: "Do seu Contador"

### Conteúdo (de cima para baixo)
1. **Banner de alerta de boletos vencidos** — aparece somente se `boletosVencidos.length > 0`. Link para `/financeiro`. Compacto, vermelho sutil, sem ocupar muito espaço.
2. **Card "Do seu Contador"** — lista de documentos enviados pelo escritório (`origem === 'UPLOAD_CONTADOR'`), até 6 itens. Itens não lidos com badge "NOVO" e fundo levemente colorido. Botão "Ver todos" no header do card.
3. **Estado vazio** — ícone + mensagem "Nenhum documento ainda. Quando seu contador enviar arquivos, eles aparecerão aqui."
4. **Rodapé** — quando todos lidos, barra verde "Todos os documentos estão lidos."

### Ações por documento
- Botão marcar como lido (só quando não lido)
- Botão baixar

---

## Seção 4 — Coluna Direita: Upload Compacto

### Título
```
<h3>Enviar para o Contador</h3>
<p>Selecione a categoria do arquivo</p>
```
Sem o texto longo atual "O que você precisa enviar hoje para o contador?".

### Cards de categoria
- Grid interno: `grid grid-cols-2 gap-2`
- 6 cards (XML, Extratos, Despesas, Impostos, Folha, Diversos)
- Tamanho compacto: `p-3`, ícone `w-8 h-8` (32px, era 40px), fonte `text-[11px]`
- Estrutura de cada card:
  ```
  ícone com gradiente (32px, rounded-lg)
  label em negrito (11px)
  descrição curta (10px, cinza)
  ```
- Hover: `hover:-translate-y-0.5 hover:shadow-md` + borda colorida por categoria
- Sem container/wrapper externo com borda — os cards ficam diretamente na aside com título simples acima

### Input file oculto
Mantido como está — `ref={inputRef}`, reutilizado por todos os cards.

---

## Seção 5 — O que é Removido

| Elemento removido | Motivo |
|---|---|
| Container branco grande ao redor dos cards de upload | Desnecessário, os cards têm sua própria identidade visual |
| Texto longo "O que você precisa enviar hoje para o contador?" | Substituído por título compacto |
| Seção "Ações Rápidas" inteira (3 links) | Duplica links já presentes na sidebar de navegação |
| Grid separado de 4 stat cards abaixo da saudação | Stats migram para linha do header |

---

## Seção 6 — Responsividade Completa

| Breakpoint | Comportamento |
|---|---|
| `< lg` (mobile/tablet) | Uma coluna. Ordem: saudação → stats 2×2 → upload (coluna direita vira seção) → documentos do contador |
| `lg+` (desktop) | Duas colunas: esquerda (3/5) documentos, direita (2/5) upload. Stats inline com saudação. |

---

## Seção 7 — Componentes Mantidos Sem Alteração

- `EnvioLoteModal` — modal de envio em lote, sem mudança
- Toast de upload — mantido no canto inferior direito
- `useDocumentosCliente` hook — sem alteração
- Lógica de boletos, stats derivados, marcar como lido — sem alteração
- Array `CATEGORIAS` — sem alteração
- `SETOR_BADGE` — sem alteração

---

## Verificação

- `npm run type-check` — zero erros TypeScript
- Testar no browser: modo claro e escuro, mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
- Clicar em cada card de upload → modal abre corretamente
- Verificar que boleto vencido aparece o banner de alerta
- Verificar estado vazio (sem documentos do contador)
