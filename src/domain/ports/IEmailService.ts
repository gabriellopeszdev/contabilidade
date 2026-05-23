export interface EnviarEmailDTO {
  destinatario: string;
  assunto: string;
  corpoHtml: string;
  corpoTexto?: string;
}

export interface NovoDocumentoEmailParams {
  emailCliente:  string;
  nomeCliente:   string;
  nomeArquivo:   string;
  setor:         string;
  urlPortal:     string;
}

export interface BoasVindasEmailParams {
  emailCliente:   string;
  nomeCliente:    string;
  nomeEscritorio: string;
  urlPortal:      string;
}

export interface RecuperacaoSenhaEmailParams {
  email: string;
  link:  string;
}

export interface ConviteClienteEmailParams {
  email: string;
  nome:  string;
  link:  string;
}

export interface IEmailService {
  enviar(dto: EnviarEmailDTO): Promise<void>;
  enviarNovoDocumentoDisponivel(params: NovoDocumentoEmailParams): Promise<void>;
  enviarBoasVindas(params: BoasVindasEmailParams): Promise<void>;
  enviarRecuperacaoSenha(params: RecuperacaoSenhaEmailParams): Promise<void>;
  enviarConviteCliente(params: ConviteClienteEmailParams): Promise<void>;
}
