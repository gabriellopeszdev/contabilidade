// ---------------------------------------------------------------------------
// Input DTO
// ---------------------------------------------------------------------------

export interface RegistrarLeituraDocumentoInputDTO {
  /** ID do documento a ser marcado como lido. */
  readonly documentoId: string;
  /**
   * ID do usuário que está visualizando o documento.
   * Obrigatório para verificação de ownership (RBAC no use case).
   */
  readonly clienteId: string;
  /**
   * ID do contador responsável pelo cliente.
   * Nulo se o próprio cliente está visualizando.
   * Usado no payload do evento para notificação WebSocket.
   */
  readonly contadorResponsavelId: string | null;
  /** IP do cliente (para audit log e payload do evento). */
  readonly ipAddress: string;
  /** User-Agent do browser (para audit log e rastreabilidade). */
  readonly userAgent?: string;
  /** ID de quem está visualizando (pode ser CLIENT ou ACCOUNTANT). */
  readonly visualizadoPorId: string;
  /** Role de quem está visualizando. */
  readonly visualizadoPorRole: 'CLIENT' | 'ACCOUNTANT' | 'ADMIN';
}

// ---------------------------------------------------------------------------
// Output DTO
// ---------------------------------------------------------------------------

export interface RegistrarLeituraDocumentoOutputDTO {
  /** ID do documento processado. */
  readonly documentoId: string;
  /**
   * `true` se esta foi a PRIMEIRA visualização (read_status mudou de false → true).
   * `false` se o documento já havia sido lido anteriormente (idempotente).
   * Útil para o front-end decidir se exibe a animação de "Novo documento lido!".
   */
  readonly primeiraLeitura: boolean;
  /**
   * Timestamp de quando o documento foi marcado como lido.
   * Se `primeiraLeitura = false`, retorna o `readAt` original (não o atual).
   */
  readonly readAt: Date;
  /** Nome do arquivo (para exibição na UI sem nova requisição). */
  readonly nomeArquivo: string;
}
