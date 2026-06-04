export interface LembreteObrigacaoData {
  nomeContador:  string;
  nomeObrigacao: string;
  vencimento:    string; // "15/06/2026"
  diasRestantes: number;
  appUrl:        string;
}

export function lembreteObrigacaoHtml(data: LembreteObrigacaoData): string {
  const urgencia = data.diasRestantes <= 1 ? '🚨 URGENTE' : data.diasRestantes <= 3 ? '⚠️ Atenção' : '📅 Lembrete';
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#f4f4f4;margin:0;padding:20px">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden">
    <div style="background:#2563eb;padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:20px">${urgencia} — Obrigação Fiscal</h1>
    </div>
    <div style="padding:24px">
      <p>Olá, <strong>${data.nomeContador}</strong>!</p>
      <p>A obrigação <strong>${data.nomeObrigacao}</strong> vence em <strong>${data.diasRestantes === 0 ? 'HOJE' : `${data.diasRestantes} dia(s)`}</strong>.</p>
      <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:16px;margin:16px 0;text-align:center">
        <p style="margin:0;font-size:18px;font-weight:bold;color:#92400e">Vencimento: ${data.vencimento}</p>
      </div>
      <div style="text-align:center;margin-top:24px">
        <a href="${data.appUrl}/calendario" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Ver Calendário</a>
      </div>
    </div>
    <div style="padding:16px;text-align:center;color:#6b7280;font-size:12px">
      <p>FiscoHub · Você recebe este e-mail pois tem lembretes ativados.</p>
    </div>
  </div>
</body>
</html>`;
}
