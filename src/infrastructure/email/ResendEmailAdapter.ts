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

  async enviar(dto: EnviarEmailDTO): Promise<void> {
    const { error } = await this.client.emails.send({
      from:    this.fromEmail,
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
      assunto:      '[Portal Contábil] Convite para acessar seu portal',
      corpoHtml,
      corpoTexto:   `Olá, ${params.nome}! Ative sua conta em: ${params.link} (expira em 48h)`,
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
      assunto:      '[Portal Contábil] Redefinição de senha',
      corpoHtml,
      corpoTexto:   `Redefina sua senha acessando: ${params.link} (expira em 2h)`,
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
      corpoTexto:   `Bem-vindo, ${params.nomeCliente}! Acesse seu portal em: ${params.urlPortal}`,
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
      corpoTexto:   `Acesse ${params.linkAssinatura} para assinar o documento ${params.nomeDocumento} (expira em ${params.expiracaoHoras}h)`,
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
      assunto:      `[Portal Contábil] Documento ${assinado ? 'assinado' : 'recusado'}: ${params.nomeDocumento}`,
      corpoHtml,
      corpoTexto:   `O documento ${params.nomeDocumento} foi ${assinado ? 'assinado' : 'recusado'} por ${params.nomeSignatario}. Acesse: ${params.urlPortal}`,
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
      assunto:      `[Portal Contábil] Novo documento disponível: ${params.nomeArquivo}`,
      corpoHtml,
      corpoTexto:   `Olá, ${params.nomeCliente}! Novo documento: ${params.nomeArquivo} (${params.setor}). Acesse: ${params.urlPortal}`,
    });
  }
}
