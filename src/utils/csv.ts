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
