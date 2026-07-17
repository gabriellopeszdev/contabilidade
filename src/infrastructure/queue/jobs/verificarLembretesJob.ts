import { prisma } from '@/infrastructure/di/Container';
import { lembreteObrigacaoHtml } from '@/infrastructure/email/templates/lembreteObrigacao';
import type { IEmailService } from '@/domain/ports/IEmailService';

export async function verificarLembretesJob(emailService: IEmailService): Promise<void> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + 7);

  const instancias = await prisma.instanciaObrigacao.findMany({
    where: {
      concluida: false,
      lembreteEnviado: false,
      vencimento: { gte: hoje, lte: limite },
    },
    include: {
      obrigacao: {
        select: {
          nome: true,
          lembreteAntecedencia: true,
          lembreteEmail: true,
          lembreteNotificacao: true,
        },
      },
      contador: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  for (const instancia of instancias) {
    const msRestantes = instancia.vencimento.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(msRestantes / (1000 * 60 * 60 * 24));

    if (diasRestantes > instancia.obrigacao.lembreteAntecedencia) continue;

    const vencimentoStr = instancia.vencimento.toLocaleDateString('pt-BR');

    if (instancia.obrigacao.lembreteEmail && instancia.contador.email) {
      await emailService.enviar({
        destinatario: instancia.contador.email,
        assunto:      `Lembrete: ${instancia.obrigacao.nome} vence em ${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}`,
        corpoHtml:    lembreteObrigacaoHtml({
          nomeContador:  instancia.contador.name,
          nomeObrigacao: instancia.obrigacao.nome,
          vencimento:    vencimentoStr,
          diasRestantes,
          appUrl:        process.env.NEXT_PUBLIC_APP_URL ?? '',
        }),
        corpoTexto: [
          `Olá, ${instancia.contador.name}!`,
          '',
          'LEMBRETE DE OBRIGAÇÃO FISCAL',
          '─────────────────────────────────',
          `A obrigação "${instancia.obrigacao.nome}" vence em ${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}.`,
          '',
          `Vencimento: ${vencimentoStr}`,
          '',
          'Acesse o calendário para gerenciar suas obrigações:',
          `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/calendario`,
          '',
          '─────────────────────────────────',
          'FiscoHub · Você recebe este e-mail pois tem lembretes de obrigações ativados.',
          'Este é um e-mail automático — por favor não responda.',
        ].join('\n'),
      });
    }

    if (instancia.obrigacao.lembreteNotificacao) {
      await prisma.notificacao.create({
        data: {
          userId:    instancia.contadorId,
          userType:  'CONTADOR',
          tipo:      'LEMBRETE_OBRIGACAO',
          titulo:    `Obrigação vence em ${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}`,
          mensagem:  `${instancia.obrigacao.nome} vence em ${vencimentoStr}`,
          metadados: { instanciaId: instancia.id, vencimento: instancia.vencimento },
        },
      });
    }

    await prisma.instanciaObrigacao.update({
      where: { id: instancia.id },
      data: { lembreteEnviado: true },
    });
  }

  // Avisos de vencimento de certificado digital (30 dias e 7 dias)
  for (const diasAntecedencia of [30, 7]) {
    const dataAlvo = new Date(hoje);
    dataAlvo.setDate(dataAlvo.getDate() + diasAntecedencia);
    const dataAlvoInicio = new Date(dataAlvo); dataAlvoInicio.setHours(0, 0, 0, 0);
    const dataAlvoFim    = new Date(dataAlvo); dataAlvoFim.setHours(23, 59, 59, 999);

    const certs = await prisma.certificadoDigital.findMany({
      where: {
        status:   'ATIVO',
        validade: { gte: dataAlvoInicio, lte: dataAlvoFim },
      },
      select: {
        id:          true,
        cnpjTitular: true,
        validade:    true,
        criadoPorId: true,
        cliente:     { select: { name: true } },
      },
    });

    for (const cert of certs) {
      // Busca e-mail do contador que cadastrou o certificado
      const contador = await prisma.usuarioContador.findUnique({
        where:  { id: cert.criadoPorId },
        select: { email: true, name: true },
      });
      if (!contador?.email) continue;

      const validadeFmt = new Date(cert.validade).toLocaleDateString('pt-BR');
      try {
        await emailService.enviar({
          destinatario: contador.email,
          assunto:      `[FiscoHub] Certificado digital de ${cert.cliente.name} vence em ${diasAntecedencia} dias`,
          corpoHtml:    `<p>O certificado digital do cliente <strong>${cert.cliente.name}</strong> (CNPJ ${cert.cnpjTitular}) vence em <strong>${validadeFmt}</strong> (${diasAntecedencia} dias).</p><p>Acesse o portal para renovar o certificado antes do vencimento.</p>`,
          corpoTexto:   `O certificado digital do cliente ${cert.cliente.name} (CNPJ ${cert.cnpjTitular}) vence em ${validadeFmt} (${diasAntecedencia} dias). Acesse o portal para renovar.`,
        });
      } catch {
        // Falha no e-mail não interrompe os demais
      }
    }
  }
}
