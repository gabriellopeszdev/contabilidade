export function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Portal Contábil</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <span style="display:inline-block;width:36px;height:36px;background:#7c3aed;border-radius:8px;line-height:36px;text-align:center;font-size:18px;color:#fff;font-weight:bold;">C</span>
                <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px;">Portal Contábil</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                Este é um e-mail automático. Por favor, não responda a esta mensagem.<br/>
                © ${new Date().getFullYear()} Portal Contábil — Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailButton(label: string, href: string, color = '#7c3aed'): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td style="border-radius:8px;background-color:${color};">
        <a href="${href}"
           target="_blank"
           style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;">${text}</h1>`;
}

export function emailSubheading(text: string): string {
  return `<p style="margin:0 0 20px;font-size:15px;color:#7c3aed;font-weight:600;">${text}</p>`;
}

export function emailText(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">${text}</p>`;
}

export function emailDivider(): string {
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;
}

export function emailInfoBox(rows: { label: string; value: string }[]): string {
  const items = rows.map(
    (r) => `<tr>
      <td style="padding:10px 16px;font-size:13px;color:#64748b;font-weight:600;white-space:nowrap;">${r.label}</td>
      <td style="padding:10px 16px;font-size:13px;color:#0f172a;font-weight:500;">${r.value}</td>
    </tr>`,
  ).join('');
  return `<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:16px 0 24px;">
    <tbody>${items}</tbody>
  </table>`;
}

export function emailNote(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">${text}</p>`;
}
