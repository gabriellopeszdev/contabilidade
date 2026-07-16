function escapeField(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCSV(headers: string[], rows: string[][]): string {
  const lines: string[] = [
    headers.map(escapeField).join(','),
    ...rows.map((row) => row.map(escapeField).join(',')),
  ];
  return lines.join('\r\n');
}

// =============================================================================
// parseCSV — Parser RFC 4180 sem dependência externa
//
// Suporta:
//   - Campos entre aspas contendo vírgulas
//   - Aspas duplas escapadas ("")
//   - Quebras de linha dentro de campos entre aspas
//   - CRLF (\r\n) e LF (\n) como delimitadores de registro
//
// Retorna matriz de strings (incluindo cabeçalho como primeira linha).
// Linhas em branco no final são ignoradas.
// =============================================================================

export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const len = csvText.length;
  let i = 0;

  while (i < len) {
    const ch = csvText[i];

    if (inQuotes) {
      if (ch === '"') {
        // Aspas duplas escapadas: "" → "
        if (i + 1 < len && csvText[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        // Fecha campo entre aspas
        inQuotes = false;
        i++;
        continue;
      }
      // Qualquer outro caractere dentro de aspas (incluindo \r\n)
      field += ch;
      i++;
      continue;
    }

    // Fora de aspas
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }

    if (ch === '\r') {
      // CRLF ou CR isolado
      row.push(field);
      field = '';
      result.push(row);
      row = [];
      i++;
      if (i < len && csvText[i] === '\n') i++; // consome o \n do CRLF
      continue;
    }

    if (ch === '\n') {
      row.push(field);
      field = '';
      result.push(row);
      row = [];
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  // Último campo/linha (arquivo pode não terminar com quebra de linha)
  if (field !== '' || row.length > 0) {
    row.push(field);
    result.push(row);
  }

  // Remove linhas completamente vazias no final
  while (result.length > 0) {
    const last = result[result.length - 1];
    if (last.length === 1 && last[0] === '') {
      result.pop();
    } else {
      break;
    }
  }

  return result;
}
