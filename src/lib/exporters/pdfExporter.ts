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

export async function gerarPDF(opts: ExportOptions): Promise<ArrayBuffer> {
  const doc  = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const MARGIN    = 40;
  const PAGE_W    = 595; // A4
  const PAGE_H    = 842;
  const ROW_H     = 18;
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

  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
