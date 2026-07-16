import type { IEmailService } from '@/domain/ports/IEmailService';

// =============================================================================
// Job: ENVIAR_CONVITES_IMPORTACAO
//
// Envia convites de ativação de conta para clientes importados em massa via CSV.
// Utiliza um intervalo de 100ms entre cada envio para não sobrecarregar o
// provedor de e-mail (rate-limiting suave).
// =============================================================================

export interface EnviarConvitesImportacaoJobData {
  convites: Array<{
    email:       string;
    nome:        string;
    inviteLink:  string;
  }>;
}

export async function enviarConvitesImportacaoJob(
  data: EnviarConvitesImportacaoJobData,
  emailService: IEmailService,
): Promise<void> {
  const { convites } = data;

  for (let i = 0; i < convites.length; i++) {
    const { email, nome, inviteLink } = convites[i];

    try {
      await emailService.enviarConviteCliente({ email, nome, link: inviteLink });
    } catch {
      // Falha em um convite não deve interromper os demais
    }

    // Intervalo de 100ms entre envios (exceto após o último)
    if (i < convites.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
