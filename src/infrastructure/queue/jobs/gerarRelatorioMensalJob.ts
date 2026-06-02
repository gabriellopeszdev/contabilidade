import { prisma } from '@/infrastructure/di/Container';
import { emailService } from '@/infrastructure/di/Container';
import { emailWrapper, emailHeading, emailSubheading, emailText, emailInfoBox, emailDivider, emailCallout, emailButton } from '../../email/emailTemplate';

export async function gerarRelatorioMensalJob(contadorId: string, mesAno: string): Promise<void> {
  // Parse mesAno: '2025-01' → startDate, endDate
  const [ano, mes] = mesAno.split('-').map(Number);
  const startDate = new Date(ano, mes - 1, 1);
  const endDate   = new Date(ano, mes, 0, 23, 59, 59, 999);

  // 1. Query contador info
  const contador = await prisma.usuarioContador.findUnique({
    where: { id: contadorId },
    select: { email: true, name: true },
  });
  if (!contador) return;

  // 2. Query clients count
  const clientesTotal = await prisma.contadorCliente.count({
    where: { contadorId },
  });

  // 3. Documents uploaded this month for contador's clients
  const clienteIds = (await prisma.contadorCliente.findMany({
    where: { contadorId },
    select: { clienteId: true },
  })).map((r) => r.clienteId);

  const documentos = await prisma.documentoFiscal.findMany({
    where: {
      clientId: { in: clienteIds },
      createdAt: { gte: startDate, lte: endDate },
      deletedAt: null,
    },
    select: { sector: true, readStatus: true },
  });

  const totalDocs    = documentos.length;
  const docsLidos    = documentos.filter((d) => d.readStatus).length;
  const docsNaoLidos = totalDocs - docsLidos;
  const porSetor: Record<string, number> = {};
  for (const d of documentos) {
    const setor = d.sector ?? 'A_CATEGORIZAR';
    porSetor[setor] = (porSetor[setor] ?? 0) + 1;
  }

  // 4. Boletos this month
  const boletos = await prisma.boletoHonorario.findMany({
    where: {
      escritorioId: contadorId,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { status: true, valor: true },
  });

  const totalBoletos    = boletos.length;
  const boletosPagePago = boletos.filter((b) => b.status === 'PAGO').length;
  const receitaMes      = boletos
    .filter((b) => b.status === 'PAGO')
    .reduce((acc, b) => acc + Number(b.valor), 0);

  // 5. Obligations due this month (completed vs pending)
  const obrigacoes = await prisma.instanciaObrigacao.findMany({
    where: {
      contadorId,
      vencimento: { gte: startDate, lte: endDate },
    },
    select: { concluida: true },
  });
  const obrigConcluidas = obrigacoes.filter((o) => o.concluida).length;
  const obrigPendentes  = obrigacoes.filter((o) => !o.concluida).length;

  const mesNome = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const setorRows = Object.entries(porSetor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([setor, qtd]) => ({ label: setor, value: String(qtd) }));

  const html = emailWrapper(`
    ${emailHeading(`Relatório Mensal — ${mesNome}`)}
    ${emailSubheading(`Olá, ${contador.name}! Aqui está o resumo do mês.`)}

    ${emailText('Confira os números do seu escritório neste período:')}

    ${emailInfoBox([
      { label: 'Clientes ativos',         value: String(clientesTotal) },
      { label: 'Documentos recebidos',     value: String(totalDocs) },
      { label: 'Documentos lidos',         value: String(docsLidos) },
      { label: 'Documentos não lidos',     value: String(docsNaoLidos) },
    ])}

    ${emailDivider()}

    ${emailInfoBox([
      { label: 'Cobranças emitidas',   value: String(totalBoletos) },
      { label: 'Cobranças pagas',       value: String(boletosPagePago) },
      { label: 'Receita do mês',        value: `R$ ${receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
    ])}

    ${emailDivider()}

    ${emailInfoBox([
      { label: 'Obrigações vencidas',   value: String(obrigacoes.length) },
      { label: 'Concluídas',            value: String(obrigConcluidas) },
      { label: 'Pendentes',             value: String(obrigPendentes) },
    ])}

    ${setorRows.length > 0 ? emailDivider() + emailInfoBox(setorRows.map(r => ({ label: `Setor: ${r.label}`, value: r.value }))) : ''}

    ${emailCallout('Para exportar relatórios detalhados em PDF ou Excel, acesse a área de Relatórios no portal.', '📊')}

    <div style="text-align:center;margin:32px 0">
      ${emailButton('Acessar Portal', `${appUrl}/relatorios`)}
    </div>
  `);

  await emailService.enviar({
    destinatario: contador.email,
    assunto:      `[Portal Contábil] Relatório Mensal — ${mesNome}`,
    corpoHtml:    html,
    corpoTexto:   `Relatório mensal de ${mesNome}: ${totalDocs} docs, ${clientesTotal} clientes, R$ ${receitaMes.toFixed(2)} receita.`,
  });
}
