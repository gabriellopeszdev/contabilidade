export interface SolicitacaoAssinaturaData {
  nomeCliente:    string;
  nomeContador:   string;
  nomeDocumento:  string;
  linkAssinatura: string;
  expiracaoHoras: number;
}

export function solicitacaoAssinaturaHtml(d: SolicitacaoAssinaturaData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>FiscoHub — Assinatura de Documento</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:#eef2f7;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:#0f2744;padding:32px 48px;text-align:center;">
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
                <tr>
                  <td style="background:rgba(255,255,255,0.10);border-radius:12px;padding:10px 22px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width:34px;height:34px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);
                                   border-radius:8px;text-align:center;vertical-align:middle;">
                          <span style="display:block;font-size:19px;font-weight:900;color:#fff;line-height:34px;
                                       font-family:Arial,sans-serif;">F</span>
                        </td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <span style="font-size:17px;font-weight:700;color:#fff;letter-spacing:-0.3px;
                                       font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
                            Fisco<span style="color:#93c5fd;">Hub</span>
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
            <td style="background:linear-gradient(90deg,#1d4ed8,#2563eb,#60a5fa);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#fff;padding:44px 48px 36px;">
              <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">
                Assinatura solicitada
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#2563eb;font-weight:600;
                         text-transform:uppercase;letter-spacing:0.6px;">Documento aguardando sua assinatura</p>

              <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.75;">
                Olá, <strong style="color:#0f172a;">${d.nomeCliente}</strong>!<br/>
                O escritório <strong style="color:#0f172a;">${d.nomeContador}</strong> solicita sua assinatura no documento abaixo:
              </p>

              <table cellpadding="0" cellspacing="0" role="presentation"
                style="width:100%;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;margin:8px 0 24px;">
                <tr>
                  <td style="padding:16px 20px;font-size:15px;color:#0f172a;font-weight:700;text-align:center;">
                    📄&nbsp;&nbsp;${d.nomeDocumento}
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 8px;">
                <tr>
                  <td style="border-radius:10px;background-color:#2563eb;box-shadow:0 2px 8px rgba(0,0,0,0.18);">
                    <a href="${d.linkAssinatura}" target="_blank"
                       style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;
                              color:#ffffff;text-decoration:none;border-radius:10px;">
                      Visualizar e Assinar&nbsp;→
                    </a>
                  </td>
                </tr>
              </table>

              <div style="border-top:1px solid #f1f5f9;margin:32px 0;"></div>

              <table cellpadding="0" cellspacing="0" role="presentation"
                style="width:100%;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
                <tr>
                  <td style="padding:14px 18px;font-size:13px;color:#334155;line-height:1.65;">
                    ⏱&nbsp;&nbsp;Este link expira em <strong>${d.expiracaoHoras} horas</strong>.
                    Se não reconhece esta solicitação, ignore este e-mail.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 48px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.8;">
                Este é um e-mail automático — por favor não responda.<br/>
                © ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.
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
