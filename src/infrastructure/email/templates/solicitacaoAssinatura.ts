export interface SolicitacaoAssinaturaData {
  nomeCliente:    string;
  nomeContador:   string;
  nomeDocumento:  string;
  linkAssinatura: string;
  expiracaoHoras: number;
}

export function solicitacaoAssinaturaHtml(d: SolicitacaoAssinaturaData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
    <div style="background:#2563eb;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">Assinatura de Documento</h1>
    </div>
    <div style="padding:24px">
      <p>Ola, <strong>${d.nomeCliente}</strong>!</p>
      <p>O escritorio <strong>${d.nomeContador}</strong> solicita sua assinatura no documento:</p>
      <div style="background:#f3f4f6;border-radius:6px;padding:16px;margin:16px 0;text-align:center">
        <p style="margin:0;font-weight:bold;font-size:16px">${d.nomeDocumento}</p>
      </div>
      <p style="color:#6b7280;font-size:14px">Este link expira em <strong>${d.expiracaoHoras} horas</strong>.</p>
      <div style="text-align:center;margin-top:24px">
        <a href="${d.linkAssinatura}" style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">Visualizar e Assinar</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Se voce nao reconhece esta solicitacao, ignore este email.</p>
    </div>
  </div>
</body>
</html>`;
}
