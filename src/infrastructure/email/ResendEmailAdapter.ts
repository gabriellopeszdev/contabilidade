import { Resend } from 'resend';
import type {
  IEmailService,
  EnviarEmailDTO,
  NovoDocumentoEmailParams,
  BoasVindasEmailParams,
  RecuperacaoSenhaEmailParams,
  ConviteClienteEmailParams,
} from '../../domain/ports/IEmailService';
import type { ILogger } from '../../domain/ports/ILogger';

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
      from: this.fromEmail,
      to:   dto.destinatario,
      subject: dto.assunto,
      html: dto.corpoHtml,
      text: dto.corpoTexto,
    });

    if (error) {
      this.logger.error('[ResendEmailAdapter] Falha ao enviar e-mail.', { error });
      throw new Error(`Resend error: ${error.message}`);
    }

    this.logger.info('[ResendEmailAdapter] E-mail enviado.', { destinatario: dto.destinatario, assunto: dto.assunto });
  }

  async enviarNovoDocumentoDisponivel(params: NovoDocumentoEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Olá, ${params.nomeCliente}!</h2>
      <p>Um novo documento foi disponibilizado no seu portal:</p>
      <ul>
        <li><strong>Arquivo:</strong> ${params.nomeArquivo}</li>
        <li><strong>Setor:</strong> ${params.setor}</li>
      </ul>
      <p>
        <a href="${params.urlPortal}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Acessar Portal</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Este é um e-mail automático. Não responda a esta mensagem.</p>
    `.trim();

    await this.enviar({
      destinatario: params.emailCliente,
      assunto:      `[Portal Contábil] Novo documento disponível: ${params.nomeArquivo}`,
      corpoHtml,
      corpoTexto:   `Olá, ${params.nomeCliente}! Novo documento: ${params.nomeArquivo} (${params.setor}). Acesse: ${params.urlPortal}`,
    });
  }

  async enviarBoasVindas(params: BoasVindasEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Bem-vindo ao portal do ${params.nomeEscritorio}, ${params.nomeCliente}!</h2>
      <p>Seu acesso ao portal de documentos fiscais foi criado com sucesso.</p>
      <p>
        <a href="${params.urlPortal}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Acessar Portal</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Em caso de dúvidas, entre em contato com o seu contador.</p>
    `.trim();

    await this.enviar({
      destinatario: params.emailCliente,
      assunto:      `Bem-vindo ao Portal — ${params.nomeEscritorio}`,
      corpoHtml,
      corpoTexto:   `Bem-vindo, ${params.nomeCliente}! Acesse: ${params.urlPortal}`,
    });
  }

  async enviarRecuperacaoSenha(params: RecuperacaoSenhaEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Redefinição de senha</h2>
      <p>Clique no botão abaixo para redefinir sua senha. O link expira em 2 horas.</p>
      <p>
        <a href="${params.link}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Redefinir senha</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Se você não solicitou a redefinição, ignore este e-mail.</p>
    `.trim();

    await this.enviar({
      destinatario: params.email,
      assunto:      '[Portal Contábil] Redefinição de senha',
      corpoHtml,
      corpoTexto:   `Redefinir senha: ${params.link}`,
    });
  }

  async enviarConviteCliente(params: ConviteClienteEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Olá, ${params.nome}!</h2>
      <p>Você foi convidado para acessar o Portal do Cliente do seu escritório de contabilidade.</p>
      <p>Clique no botão abaixo para criar sua senha e ativar sua conta. O link expira em 48 horas.</p>
      <p>
        <a href="${params.link}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Ativar minha conta</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Este é um e-mail automático. Não responda a esta mensagem.</p>
    `.trim();

    await this.enviar({
      destinatario: params.email,
      assunto:      '[Portal Contábil] Convite para acessar seu portal',
      corpoHtml,
      corpoTexto:   `Olá, ${params.nome}! Ative sua conta em: ${params.link}`,
    });
  }
}
