export function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Portal Contábil</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background-color:#eef2f7;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:#1e1b4b;padding:36px 48px 32px;text-align:center;">
              <!-- Logo pill -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 0;">
                <tr>
                  <td style="background:rgba(255,255,255,0.12);border-radius:12px;padding:10px 20px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background:#7c3aed;width:28px;height:28px;border-radius:6px;
                                   text-align:center;vertical-align:middle;">
                          <span style="font-size:14px;font-weight:800;color:#fff;line-height:28px;">C</span>
                        </td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <span style="font-size:16px;font-weight:700;color:#fff;letter-spacing:-0.2px;">
                            Portal Contábil
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background:linear-gradient(90deg,#7c3aed,#4f46e5,#2563eb);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:44px 48px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.8;">
                Este é um e-mail automático — por favor não responda.<br/>
                © ${new Date().getFullYear()} Portal Contábil · Todos os direitos reservados.
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
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0 8px;">
    <tr>
      <td style="border-radius:10px;background-color:${color};
                 box-shadow:0 2px 8px rgba(0,0,0,0.18);">
        <a href="${href}" target="_blank"
           style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;
                  color:#ffffff;text-decoration:none;border-radius:10px;
                  letter-spacing:0.1px;">${label}&nbsp;→</a>
      </td>
    </tr>
  </table>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#0f172a;
                     letter-spacing:-0.6px;line-height:1.2;">${text}</h1>`;
}

export function emailSubheading(text: string): string {
  return `<p style="margin:0 0 24px;font-size:14px;color:#7c3aed;font-weight:600;
                    text-transform:uppercase;letter-spacing:0.6px;">${text}</p>`;
}

export function emailText(text: string): string {
  return `<p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.75;">${text}</p>`;
}

export function emailDivider(): string {
  return `<div style="border-top:1px solid #f1f5f9;margin:32px 0;"></div>`;
}

export function emailCallout(text: string, icon = 'ℹ️', color = '#f0f9ff', border = '#bae6fd'): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation"
            style="width:100%;background:${color};border:1px solid ${border};
                   border-radius:10px;margin:8px 0 4px;">
    <tr>
      <td style="padding:14px 18px;font-size:13px;color:#334155;line-height:1.65;">
        <span style="margin-right:8px;">${icon}</span>${text}
      </td>
    </tr>
  </table>`;
}

export function emailWarningCallout(text: string): string {
  return emailCallout(text, '⏱', '#fffbeb', '#fde68a');
}

export function emailInfoBox(rows: { label: string; value: string }[]): string {
  const items = rows.map((r, i) => {
    const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    return `<tr>
      <td style="padding:12px 16px;font-size:12px;color:#64748b;font-weight:700;
                 white-space:nowrap;background:${bg};
                 border-right:1px solid #e2e8f0;width:120px;
                 text-transform:uppercase;letter-spacing:0.4px;">${r.label}</td>
      <td style="padding:12px 16px;font-size:14px;color:#0f172a;font-weight:500;background:${bg};">${r.value}</td>
    </tr>`;
  }).join('');
  return `<table cellpadding="0" cellspacing="0" role="presentation"
    style="width:100%;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:20px 0 28px;">
    <tbody>${items}</tbody>
  </table>`;
}
