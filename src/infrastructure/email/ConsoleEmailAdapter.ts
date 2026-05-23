import type {
  IEmailService,
  EnviarEmailDTO,
  NovoDocumentoEmailParams,
  BoasVindasEmailParams,
  RecuperacaoSenhaEmailParams,
  ConviteClienteEmailParams,
} from '../../domain/ports/IEmailService';
import type { ILogger } from '../../domain/ports/ILogger';

// =============================================================================
// ConsoleEmailAdapter — Implementação de Desenvolvimento/Teste
//
// Imprime os e-mails no logger estruturado (nível INFO) em vez de enviá-los.
// Serve para dois propósitos:
//
//   1. DESENVOLVIMENTO: Sem necessidade de configurar credenciais SMTP.
//      O conteúdo do e-mail aparece no terminal em formato legível.
//
//   2. PROVA DE DI: Demonstra que a camada de aplicação (use cases) depende
//      apenas de `IEmailService` e não de qualquer provedor concreto.
//      Trocar para `NodemailerAdapter` em produção não requer nenhuma
//      mudança fora do Container.ts.
//
// COMO TROCAR PARA PRODUÇÃO:
//   Em Container.ts, substitua:
//     const emailService = new ConsoleEmailAdapter(logger);
//   Por:
//     const emailService = new NodemailerAdapter(smtpConfig, logger);
// =============================================================================

export class ConsoleEmailAdapter implements IEmailService {
  constructor(private readonly logger: ILogger) {}

  // ---------------------------------------------------------------------------
  // Envio genérico
  // ---------------------------------------------------------------------------

  async enviar(dto: EnviarEmailDTO): Promise<void> {
    this.logger.info('[ConsoleEmailAdapter] E-mail simulado enviado.', {
      destinatario: dto.destinatario,
      assunto:      dto.assunto,
      // Trunca o corpo para não poluir o log com HTML extenso
      corpoHtml:    dto.corpoHtml.slice(0, 200) + (dto.corpoHtml.length > 200 ? '...' : ''),
    });
  }

  // ---------------------------------------------------------------------------
  // Template: Novo Documento Disponível
  // ---------------------------------------------------------------------------

  async enviarNovoDocumentoDisponivel(params: NovoDocumentoEmailParams): Promise<void> {
    const { emailCliente, nomeCliente, nomeArquivo, setor, urlPortal } = params;

    const corpoHtml = `
      <h2>Olá, ${nomeCliente}!</h2>
      <p>
        Um novo documento foi disponibilizado no seu portal:
      </p>
      <ul>
        <li><strong>Arquivo:</strong> ${nomeArquivo}</li>
        <li><strong>Setor:</strong> ${setor}</li>
      </ul>
      <p>
        <a href="${urlPortal}" style="
          background:#2563eb;color:#fff;padding:12px 24px;
          border-radius:6px;text-decoration:none;font-weight:bold;
        ">Acessar Portal</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">
        Este é um e-mail automático. Não responda a esta mensagem.
      </p>
    `.trim();

    await this.enviar({
      destinatario: emailCliente,
      assunto:      `[Portal Contábil] Novo documento disponível: ${nomeArquivo}`,
      corpoHtml,
      corpoTexto:   `Olá, ${nomeCliente}! Um novo documento foi disponibilizado: ${nomeArquivo} (${setor}). Acesse: ${urlPortal}`,
    });

    // Log detalhado adicional para desenvolvimento — facilita rastrear o fluxo
    this.logger.debug('[ConsoleEmailAdapter] Template novoDocumento renderizado.', {
      destinatario: emailCliente,
      nomeArquivo,
      setor,
    });
  }

  // ---------------------------------------------------------------------------
  // Template: Boas-vindas ao novo cliente
  // ---------------------------------------------------------------------------

  async enviarBoasVindas(params: BoasVindasEmailParams): Promise<void> {
    const { emailCliente, nomeCliente, nomeEscritorio, urlPortal } = params;

    const corpoHtml = `
      <h2>Bem-vindo ao portal do ${nomeEscritorio}, ${nomeCliente}!</h2>
      <p>
        Seu acesso ao portal de documentos fiscais foi criado com sucesso.
        A partir de agora, você poderá visualizar e baixar todos os seus documentos.
      </p>
      <p>
        <a href="${urlPortal}" style="
          background:#16a34a;color:#fff;padding:12px 24px;
          border-radius:6px;text-decoration:none;font-weight:bold;
        ">Acessar Portal</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">
        Em caso de dúvidas, entre em contato com o seu contador.
      </p>
    `.trim();

    await this.enviar({
      destinatario: emailCliente,
      assunto:      `Bem-vindo ao Portal — ${nomeEscritorio}`,
      corpoHtml,
      corpoTexto:   `Bem-vindo, ${nomeCliente}! Seu acesso ao portal foi criado. Acesse: ${urlPortal}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Template: Recuperação de Senha
  // ---------------------------------------------------------------------------

  async enviarRecuperacaoSenha(params: RecuperacaoSenhaEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Redefinição de senha</h2>
      <p>Clique no botão abaixo para redefinir sua senha. O link expira em 2 horas.</p>
      <p>
        <a href="${params.link}" style="
          background:#7c3aed;color:#fff;padding:12px 24px;
          border-radius:6px;text-decoration:none;font-weight:bold;
        ">Redefinir senha</a>
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

  // ---------------------------------------------------------------------------
  // Template: Convite para Cliente
  // ---------------------------------------------------------------------------

  async enviarConviteCliente(params: ConviteClienteEmailParams): Promise<void> {
    const corpoHtml = `
      <h2>Olá, ${params.nome}!</h2>
      <p>Você foi convidado para acessar o Portal do Cliente do seu escritório de contabilidade.</p>
      <p>Clique no botão abaixo para criar sua senha e ativar sua conta. O link expira em 48 horas.</p>
      <p>
        <a href="${params.link}" style="
          background:#16a34a;color:#fff;padding:12px 24px;
          border-radius:6px;text-decoration:none;font-weight:bold;
        ">Ativar minha conta</a>
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
