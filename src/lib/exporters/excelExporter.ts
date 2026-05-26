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

export async function gerarExcel(opts: ExcelOptions): Promise<ArrayBuffer> {
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

  const buf = await wb.xlsx.writeBuffer();
  const nb = buf as unknown as Buffer;
  return nb.buffer.slice(nb.byteOffset, nb.byteOffset + nb.byteLength) as ArrayBuffer;
}
