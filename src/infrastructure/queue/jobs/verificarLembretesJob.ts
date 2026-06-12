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
        corpoTexto: `Olá ${instancia.contador.name}, a obrigação "${instancia.obrigacao.nome}" vence em ${vencimentoStr} (${diasRestantes === 0 ? 'HOJE' : `${diasRestantes} dia(s)`}).`,
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
}
