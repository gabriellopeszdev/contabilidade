# Exportação PDF e Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar exportação de relatórios em PDF e Excel para: lista de documentos por cliente, relatório financeiro de boletos e lista de clientes do escritório.

**Architecture:** Cada rota de exportação existente (ou nova) recebe `?format=pdf|excel` e retorna o arquivo com Content-Disposition. PDF usa `pdf-lib` (já instalado) com layout tabular simples. Excel usa `exceljs`. Nenhuma fila necessária — geração síncrona (arquivos pequenos).

**Tech Stack:** `pdf-lib` (já instalado), `exceljs` (novo), `@pdf-lib/fontkit` (já instalado)

---

## Arquivo Map

| Ação | Arquivo |
|------|---------|
| Create | `src/lib/exporters/pdfExporter.ts` |
| Create | `src/lib/exporters/excelExporter.ts` |
| Create | `app/api/v1/relatorios/documentos/route.ts` |
| Create | `app/api/v1/relatorios/financeiro/route.ts` |
| Create | `app/api/v1/relatorios/clientes/route.ts` |
| Create | `app/(contador)/relatorios/page.tsx` |

---

## Task 1: Instalar exceljs

- [ ] **Step 1: Instalar**

```bash
npm install exceljs
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(export): install exceljs"
```

---

## Task 2: Helper PDF

**Files:**
- Create: `src/lib/exporters/pdfExporter.ts`

- [ ] **Step 1: Criar exportador PDF genérico**

```typescript
import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib';

export interface ExportColumn {
  header: string;
  key:    string;
  width:  number; // proporção 0-1
}

export interface ExportOptions {
  titulo:   string;
  subtitulo?: string;
  colunas:  ExportColumn[];
  linhas:   Record<string, string>[];
  rodape?:  string;
}

export async function gerarPDF(opts: ExportOptions): Promise<Uint8Array> {
  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const MARGIN    = 40;
  const PAGE_W    = 595; // A4
  const PAGE_H    = 842;
  const ROW_H     = 18;
  const HEADER_H  = 80;
  const TABLE_W   = PAGE_W - MARGIN * 2;

  function addPage(): PDFPage {
    return doc.addPage([PAGE_W, PAGE_H]);
  }

  let page = addPage();
  let y    = PAGE_H - MARGIN;

  // Título
  page.drawText(opts.titulo, { x: MARGIN, y, font: bold, size: 14, color: rgb(0.09, 0.39, 0.92) });
  y -= 20;
  if (opts.subtitulo) {
    page.drawText(opts.subtitulo, { x: MARGIN, y, font, size: 9, color: rgb(0.4, 0.4, 0.4) });
    y -= 14;
  }
  page.drawText(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { x: MARGIN, y, font, size: 8, color: rgb(0.5, 0.5, 0.5) });
  y -= 20;

  // Linha separadora
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: rgb(0.09, 0.39, 0.92) });
  y -= 4;

  // Cabeçalho da tabela
  let x = MARGIN;
  page.drawRectangle({ x: MARGIN, y: y - ROW_H + 4, width: TABLE_W, height: ROW_H, color: rgb(0.09, 0.39, 0.92) });
  for (const col of opts.colunas) {
    page.drawText(col.header, { x: x + 3, y: y - 10, font: bold, size: 8, color: rgb(1, 1, 1) });
    x += col.width * TABLE_W;
  }
  y -= ROW_H;

  // Linhas de dados
  for (let i = 0; i < opts.linhas.length; i++) {
    if (y < MARGIN + ROW_H) {
      page = addPage();
      y    = PAGE_H - MARGIN;
    }

    const linha = opts.linhas[i];
    const bg    = i % 2 === 0 ? rgb(0.97, 0.97, 0.97) : rgb(1, 1, 1);
    page.drawRectangle({ x: MARGIN, y: y - ROW_H + 4, width: TABLE_W, height: ROW_H, color: bg });

    x = MARGIN;
    for (const col of opts.colunas) {
      const texto = String(linha[col.key] ?? '').slice(0, 40);
      page.drawText(texto, { x: x + 3, y: y - 10, font, size: 8, color: rgb(0.1, 0.1, 0.1) });
      x += col.width * TABLE_W;
    }
    y -= ROW_H;
  }

  // Rodapé
  if (opts.rodape) {
    const lastPage = doc.getPages().at(-1)!;
    lastPage.drawText(opts.rodape, { x: MARGIN, y: MARGIN - 10, font, size: 7, color: rgb(0.5, 0.5, 0.5) });
  }

  return doc.save();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/exporters/pdfExporter.ts
git commit -m "feat(export): add generic PDF table exporter"
```

---

## Task 3: Helper Excel

**Files:**
- Create: `src/lib/exporters/excelExporter.ts`

- [ ] **Step 1: Criar exportador Excel genérico**

```typescript
import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key:    string;
  width:  number;
}

export interface ExcelOptions {
  titulo:   string;
  planilha: string;
  colunas:  ExcelColumn[];
  linhas:   Record<string, unknown>[];
}

export async function gerarExcel(opts: ExcelOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Konto Contábil';
  wb.created = new Date();

  const ws = wb.addWorksheet(opts.planilha);

  // Título
  ws.mergeCells('A1', `${String.fromCharCode(64 + opts.colunas.length)}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value         = opts.titulo;
  titleCell.font          = { bold: true, size: 14, color: { argb: 'FF2563EB' } };
  titleCell.alignment     = { horizontal: 'center' };

  ws.addRow([`Gerado em: ${new Date().toLocaleString('pt-BR')}`]);
  ws.addRow([]);

  // Cabeçalhos
  ws.columns = opts.colunas.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const headerRow = ws.getRow(4);
  headerRow.values = ['', ...opts.colunas.map((c) => c.header)];
  headerRow.eachCell((cell, col) => {
    if (col > 1) {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    }
  });

  // Dados
  opts.linhas.forEach((linha, i) => {
    const row = ws.addRow(opts.colunas.map((c) => linha[c.key] ?? ''));
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      });
    }
  });

  // Auto-filtro
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: opts.colunas.length } };

  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/exporters/excelExporter.ts
git commit -m "feat(export): add generic Excel exporter with auto-filter and styling"
```

---

## Task 4: Rota — relatório de documentos

**Files:**
- Create: `app/api/v1/relatorios/documentos/route.ts`

- [ ] **Step 1: Criar rota**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';
import { gerarPDF, ExportColumn } from '@/src/lib/exporters/pdfExporter';
import { gerarExcel } from '@/src/lib/exporters/excelExporter';

const COLUNAS: ExportColumn[] = [
  { header: 'Arquivo',      key: 'fileName',   width: 0.35 },
  { header: 'Tipo',         key: 'fileType',   width: 0.08 },
  { header: 'Setor',        key: 'sector',     width: 0.12 },
  { header: 'Competência',  key: 'competencia',width: 0.12 },
  { header: 'Lido',         key: 'lido',       width: 0.08 },
  { header: 'Enviado em',   key: 'createdAt',  width: 0.25 },
];

export const GET = withAuth(async (req) => {
  const { searchParams } = req.nextUrl;
  const format    = searchParams.get('format') ?? 'pdf';
  const clienteId = searchParams.get('clienteId');

  const documentos = await prisma.documentoFiscal.findMany({
    where: { deletedAt: null, ...(clienteId ? { clientId: clienteId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: { fileName: true, fileType: true, sector: true, competencia: true, readStatus: true, createdAt: true },
  });

  const linhas = documentos.map((d) => ({
    fileName:   d.fileName,
    fileType:   d.fileType,
    sector:     d.sector,
    competencia: d.competencia ? new Date(d.competencia).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : '-',
    lido:       d.readStatus ? 'Sim' : 'Não',
    createdAt:  new Date(d.createdAt).toLocaleDateString('pt-BR'),
  }));

  if (format === 'excel') {
    const buffer = await gerarExcel({ titulo: 'Relatório de Documentos Fiscais', planilha: 'Documentos', colunas: COLUNAS, linhas });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="documentos.xlsx"',
      },
    });
  }

  const bytes = await gerarPDF({ titulo: 'Relatório de Documentos Fiscais', colunas: COLUNAS, linhas });
  return new NextResponse(bytes, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="documentos.pdf"' },
  });
}, ['ACCOUNTANT', 'EMPLOYEE', 'ADMIN']);
```

- [ ] **Step 2: Criar rota financeira e de clientes seguindo o mesmo padrão**

Criar `app/api/v1/relatorios/financeiro/route.ts` — query em `BoletoHonorario` com colunas: Cliente, Valor, Vencimento, Status, Mês Referência.

Criar `app/api/v1/relatorios/clientes/route.ts` — query em `UsuarioCliente` via `ContadorCliente` com colunas: Nome, CNPJ, Email, Telefone, Ativo, Desde.

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/relatorios/
git commit -m "feat(export): add PDF/Excel export routes for documentos, financeiro, clientes"
```

---

## Task 5: Página de relatórios no frontend

**Files:**
- Create: `app/(contador)/relatorios/page.tsx`

- [ ] **Step 1: Criar página**

Página simples com 3 cards (Documentos, Financeiro, Clientes) cada com botões "Exportar PDF" e "Exportar Excel" que fazem `window.open('/api/v1/relatorios/[tipo]?format=pdf|excel')`.

```tsx
'use client';

const relatorios = [
  { titulo: 'Documentos Fiscais',    href: '/api/v1/relatorios/documentos',  descricao: 'Lista completa de documentos enviados por clientes' },
  { titulo: 'Financeiro / Boletos',  href: '/api/v1/relatorios/financeiro',  descricao: 'Histórico de cobranças e status de pagamento' },
  { titulo: 'Carteira de Clientes',  href: '/api/v1/relatorios/clientes',    descricao: 'Lista de clientes do escritório com dados de contato' },
];

export default function RelatoriosPage() {
  function exportar(href: string, format: 'pdf' | 'excel') {
    window.open(`${href}?format=${format}`, '_blank');
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Relatórios</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {relatorios.map((r) => (
          <div key={r.href} className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">{r.titulo}</h2>
            <p className="text-sm text-muted-foreground">{r.descricao}</p>
            <div className="flex gap-2">
              <button onClick={() => exportar(r.href, 'pdf')} className="flex-1 btn btn-outline text-sm">PDF</button>
              <button onClick={() => exportar(r.href, 'excel')} className="flex-1 btn btn-primary text-sm">Excel</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar link na sidebar**

Encontre o componente de sidebar do contador e adicione link para `/relatorios`.

- [ ] **Step 3: Commit**

```bash
git add app/\(contador\)/relatorios/
git commit -m "feat(export): add relatorios page with PDF/Excel download buttons"
```

---

## Verificação final

- [ ] Exportar documentos como PDF → arquivo abre com tabela correta
- [ ] Exportar financeiro como Excel → planilha com filtros funcionando
- [ ] `npm run build` sem erros
