import { Resend } from 'resend';
import type {
  IEmailService,
  EnviarEmailDTO,
  NovoDocumentoEmailParams,
  BoasVindasEmailParams,
  RecuperacaoSenhaEmailParams,
  ConviteClienteEmailParams,
  SolicitacaoAssinaturaEmailParams,
  StatusAssinaturaEmailParams,
  OtpAssinaturaEmailParams,
  NovoDocumentoContadorEmailParams,
} from '../../domain/ports/IEmailService';
import type { ILogger } from '../../domain/ports/ILogger';
import { solicitacaoAssinaturaHtml } from './templates/solicitacaoAssinatura';
import {
  emailWrapper,
  emailButton,
  emailHeading,
  emailSubheading,
  emailText,
  emailDivider,
  emailInfoBox,
  emailCallout,
  emailWarningCallout,
} from './emailTemplate';

export class ResendEmailAdapter implements IEmailService {
  private readonly client: Resend;

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly logger: ILogger,
  ) {
    this.client = new Resend(apiKey);
  }

  private get from(): string {
    // Se o fromEmail já tem nome de exibição, usa como está
    if (this.fromEmail.includes('<')) return this.fromEmail;
    const name = process.env.RESEND_FROM_NAME ?? 'FiscoHub';
    return `${name} <${this.fromEmail}>`;
  }

  async enviar(dto: EnviarEmailDTO): Promise<void> {
    const { error } = await this.client.emails.send({
      from:    this.from,
      to:      dto.destinatario,
      subject: dto.assunto,
      html:    dto.corpoHtml,
      text:    dto.corpoTexto,
    });

    if (error) {
      this.logger.error('[ResendEmailAdapter] Falha ao enviar e-mail.', { error });
      throw new Error(`Resend error: ${error.message}`);
    }

    this.logger.info('[ResendEmailAdapter] E-mail enviado.', {
      destinatario: dto.destinatario,
      assunto: dto.assunto,
    });
  }

  async enviarConviteCliente(params: ConviteClienteEmailParams): Promise<void> {
    const corpoHtml = emailWrapper(
      emailHeading(`Olá, ${params.nome}!`) +
      emailSubheading('Convite para o Portal do Cliente') +
      emailText(
        'Seu escritório de contabilidade criou um acesso exclusivo para você. ' +
        'Clique no botão abaixo para criar sua senha e ativar sua conta.',
      ) +
      emailButton('Ativar minha conta', params.link, '#16a34a') +
      emailDivider() +
      emailWarningCallout('O link de ativação expira em <strong>48 horas</strong>. Após esse prazo, solicite um novo convite ao seu contador.'),
    );

    await this.enviar({
      destinatario: params.email,
      assunto:      '[FiscoHub] Convite para acessar seu portal',
      corpoHtml,
      corpoTexto:   [
        `Olá, ${params.nome}!`,
        '',
        'CONVITE PARA O PORTAL DO CLIENTE',
        '─────────────────────────────────',
        'Seu escritório de contabilidade criou um acesso exclusivo para você.',
        '',
        'Para criar sua senha e ativar sua conta, acesse o link abaixo:',
        params.link,
        '',
        'ATENÇÃO: Este link expira em 48 horas. Após esse prazo, solicite um novo convite ao seu contador.',
        '',
        '─────────────────────────────────',
        'Este é um e-mail automático — por favor não responda.',
        `© ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.`,
      ].join('\n'),
    });
  }

  async enviarRecuperacaoSenha(params: RecuperacaoSenhaEmailParams): Promise<void> {
    const corpoHtml = emailWrapper(
      emailHeading('Redefinição de senha') +
      emailSubheading('Solicitação de nova senha') +
      emailText(
        'Se foi você quem solicitou, clique no botão abaixo para criar uma nova senha. ' +
        'Caso não tenha feito esta solicitação, ignore este e-mail — sua senha permanece a mesma.',
      ) +
      emailButton('Redefinir minha senha', params.link, '#7c3aed') +
      emailDivider() +
      emailWarningCallout('Por segurança, este link expira em <strong>2 horas</strong>. Após esse prazo, solicite uma nova redefinição na página de login.'),
    );

    await this.enviar({
      destinatario: params.email,
      assunto:      '[FiscoHub] Redefinição de senha',
      corpoHtml,
      corpoTexto:   [
        'REDEFINIÇÃO DE SENHA — FiscoHub',
        '─────────────────────────────────',
        'Se foi você quem solicitou, acesse o link abaixo para criar uma nova senha:',
        params.link,
        '',
        'Caso não tenha feito esta solicitação, ignore este e-mail — sua senha permanece a mesma.',
        '',
        'ATENÇÃO: Por segurança, este link expira em 2 horas.',
        '',
        '─────────────────────────────────',
        'Este é um e-mail automático — por favor não responda.',
        `© ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.`,
      ].join('\n'),
    });
  }

  async enviarBoasVindas(params: BoasVindasEmailParams): Promise<void> {
    const corpoHtml = emailWrapper(
      emailHeading(`Bem-vindo, ${params.nomeCliente}!`) +
      emailSubheading(`Acesso liberado — ${params.nomeEscritorio}`) +
      emailText(
        'Seu acesso ao Portal de Documentos Fiscais foi criado com sucesso. ' +
        'Por aqui você pode visualizar e baixar todos os documentos disponibilizados pelo seu contador.',
      ) +
      emailButton('Acessar meu portal', params.urlPortal, '#16a34a') +
      emailDivider() +
      emailCallout('Em caso de dúvidas, entre em contato diretamente com o seu escritório de contabilidade.', '💬'),
    );

    await this.enviar({
      destinatario: params.emailCliente,
      assunto:      `Bem-vindo ao Portal — ${params.nomeEscritorio}`,
      corpoHtml,
      corpoTexto:   [
        `Bem-vindo, ${params.nomeCliente}!`,
        '',
        `ACESSO LIBERADO — ${params.nomeEscritorio}`,
        '─────────────────────────────────',
        'Seu acesso ao Portal de Documentos Fiscais foi criado com sucesso.',
        'Por aqui você pode visualizar e baixar todos os documentos disponibilizados pelo seu contador.',
        '',
        'Acesse seu portal:',
        params.urlPortal,
        '',
        'Em caso de dúvidas, entre em contato diretamente com o seu escritório de contabilidade.',
        '',
        '─────────────────────────────────',
        'Este é um e-mail automático — por favor não responda.',
        `© ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.`,
      ].join('\n'),
    });
  }

  async enviarSolicitacaoAssinatura(params: SolicitacaoAssinaturaEmailParams): Promise<void> {
    const html = solicitacaoAssinaturaHtml({
      nomeCliente:    params.nomeCliente,
      nomeContador:   'Seu escritório contábil',
      nomeDocumento:  params.nomeDocumento,
      linkAssinatura: params.linkAssinatura,
      expiracaoHoras: params.expiracaoHoras,
    });

    await this.enviar({
      destinatario: params.emailCliente,
      assunto:      `Assinatura solicitada: ${params.nomeDocumento}`,
      corpoHtml:    html,
      corpoTexto:   [
        `Olá, ${params.nomeCliente}!`,
        '',
        'DOCUMENTO AGUARDANDO SUA ASSINATURA',
        '─────────────────────────────────',
        'O escritório solicitou sua assinatura no seguinte documento:',
        `"${params.nomeDocumento}"`,
        '',
        'Para visualizar e assinar, acesse:',
        params.linkAssinatura,
        '',
        `ATENÇÃO: Este link expira em ${params.expiracaoHoras} horas.`,
        'Se não reconhece esta solicitação, ignore este e-mail.',
        '',
        '─────────────────────────────────',
        'Este é um e-mail automático — por favor não responda.',
        `© ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.`,
      ].join('\n'),
    });
  }

  async enviarStatusAssinatura(params: StatusAssinaturaEmailParams): Promise<void> {
    const assinado = params.status === 'ASSINADO';
    const corpoHtml = emailWrapper(
      emailHeading(`Documento ${assinado ? 'assinado' : 'recusado'}`) +
      emailSubheading(assinado ? 'Assinatura confirmada' : 'Assinatura recusada') +
      emailText(
        `Olá, <strong>${params.nomeSolicitante}</strong>! ` +
        (assinado
          ? `O documento <strong>${params.nomeDocumento}</strong> foi assinado por <strong>${params.nomeSignatario}</strong>.`
          : `O documento <strong>${params.nomeDocumento}</strong> teve a assinatura recusada por <strong>${params.nomeSignatario}</strong>.`)
      ) +
      (params.motivoRecusa ? emailWarningCallout(`Motivo: ${params.motivoRecusa}`) : '') +
      emailButton('Ver no portal', params.urlPortal, assinado ? '#16a34a' : '#dc2626') +
      emailDivider() +
      emailCallout('Acesse o portal para mais detalhes sobre o documento.', assinado ? '✅' : '❌'),
    );

    await this.enviar({
      destinatario: params.emailSolicitante,
      assunto:      `[FiscoHub] Documento ${assinado ? 'assinado' : 'recusado'}: ${params.nomeDocumento}`,
      corpoHtml,
      corpoTexto:   [
        `Olá, ${params.nomeSolicitante}!`,
        '',
        `DOCUMENTO ${assinado ? 'ASSINADO' : 'RECUSADO'}`,
        '─────────────────────────────────',
        `O documento "${params.nomeDocumento}" foi ${assinado ? 'assinado' : 'recusado'} por ${params.nomeSignatario}.`,
        ...(params.motivoRecusa ? ['', `Motivo: ${params.motivoRecusa}`] : []),
        '',
        'Acesse o portal para mais detalhes:',
        params.urlPortal,
        '',
        '─────────────────────────────────',
        'Este é um e-mail automático — por favor não responda.',
        `© ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.`,
      ].join('\n'),
    });
  }

  async enviarOtpAssinatura(params: OtpAssinaturaEmailParams): Promise<void> {
    const corpoHtml = emailWrapper(
      emailHeading('Código de verificação') +
      emailSubheading(`Assinatura: ${params.nomeDocumento}`) +
      emailText(`Olá, <strong>${params.nomeCliente}</strong>! Use o código abaixo para confirmar sua identidade e assinar o documento.`) +
      `<div style="text-align:center;margin:32px 0;">
        <div style="display:inline-block;background:#1e40af;color:#fff;font-size:36px;font-weight:800;
                    letter-spacing:12px;padding:20px 36px;border-radius:12px;font-family:monospace;">
          ${params.codigo}
        </div>
      </div>` +
      emailWarningCallout('Este código é válido por <strong>15 minutos</strong> e só pode ser usado uma vez. Não compartilhe com ninguém.'),
    );

    await this.enviar({
      destinatario: params.emailCliente,
      assunto:      `${params.codigo} — Código de verificação FiscoHub`,
      corpoHtml,
      corpoTexto:   [
        `Olá, ${params.nomeCliente}!`,
        '',
        `CÓDIGO DE VERIFICAÇÃO — ${params.nomeDocumento}`,
        '─────────────────────────────────',
        'Use o código abaixo para confirmar sua identidade e assinar o documento:',
        '',
        `    ${params.codigo}`,
        '',
        'ATENÇÃO: Este código é válido por 15 minutos e só pode ser usado uma vez.',
        'Não compartilhe com ninguém.',
        '',
        '─────────────────────────────────',
        'Este é um e-mail automático — por favor não responda.',
        `© ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.`,
      ].join('\n'),
    });
  }

  async enviarNovoDocumentoContador(params: NovoDocumentoContadorEmailParams): Promise<void> {
    const corpoHtml = emailWrapper(
      emailHeading(`${params.nomeCliente} enviou um documento`) +
      emailSubheading('Novo Documento Recebido') +
      emailText(
        `O cliente <strong>${params.nomeCliente}</strong> enviou um novo documento para sua análise.`,
      ) +
      emailInfoBox([
        { label: 'Arquivo', value: params.nomeArquivo },
        { label: 'Setor',   value: params.setor },
      ]) +
      emailButton('Ver no Painel', `${params.urlPortal}/kanban`),
    );

    await this.enviar({
      destinatario: params.emailContador,
      assunto:      `Novo documento recebido de ${params.nomeCliente}`,
      corpoHtml,
      corpoTexto:   [
        `Olá, ${params.nomeContador}!`,
        '',
        'NOVO DOCUMENTO RECEBIDO',
        '─────────────────────────────────',
        `O cliente ${params.nomeCliente} enviou um novo documento para sua análise.`,
        '',
        `Arquivo: ${params.nomeArquivo}`,
        `Setor: ${params.setor}`,
        '',
        'Acesse o painel para visualizar:',
        `${params.urlPortal}/kanban`,
        '',
        '─────────────────────────────────',
        'Este é um e-mail automático — por favor não responda.',
        `© ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.`,
      ].join('\n'),
    });
  }

  async enviarNovoDocumentoDisponivel(params: NovoDocumentoEmailParams): Promise<void> {
    const corpoHtml = emailWrapper(
      emailHeading(`Olá, ${params.nomeCliente}!`) +
      emailSubheading('Novo documento disponível') +
      emailText('Seu escritório disponibilizou um novo documento no portal. Confira os detalhes abaixo:') +
      emailInfoBox([
        { label: 'Arquivo', value: params.nomeArquivo },
        { label: 'Setor',   value: params.setor },
      ]) +
      emailButton('Ver documento', params.urlPortal, '#2563eb') +
      emailDivider() +
      emailCallout('Este documento foi disponibilizado pelo seu escritório de contabilidade.', '📄'),
    );

    await this.enviar({
      destinatario: params.emailCliente,
      assunto:      `[FiscoHub] Novo documento disponível: ${params.nomeArquivo}`,
      corpoHtml,
      corpoTexto:   [
        `Olá, ${params.nomeCliente}!`,
        '',
        'NOVO DOCUMENTO DISPONÍVEL',
        '─────────────────────────────────',
        'Seu escritório disponibilizou um novo documento no portal.',
        '',
        `Arquivo: ${params.nomeArquivo}`,
        `Setor: ${params.setor}`,
        '',
        'Acesse para visualizar o documento:',
        params.urlPortal,
        '',
        'Este documento foi disponibilizado pelo seu escritório de contabilidade.',
        '',
        '─────────────────────────────────',
        'Este é um e-mail automático — por favor não responda.',
        `© ${new Date().getFullYear()} FiscoHub · Todos os direitos reservados.`,
      ].join('\n'),
    });
  }
}
