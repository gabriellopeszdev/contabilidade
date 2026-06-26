// ---------------------------------------------------------------------------
// Tipos de retorno do Storage
// ---------------------------------------------------------------------------

export interface PresignedUrlUpload {
  /** URL pré-assinada para o cliente fazer PUT direto no MinIO. */
  readonly url: string;
  /** Quando a URL expira (para exibição ao usuário e validação server-side). */
  readonly expiresAt: Date;
  /** Caminho no bucket que será usado no upload (para confirmar ao final). */
  readonly storageKey: string;
}

export interface PresignedUrlDownload {
  /** URL pré-assinada para download direto do MinIO (bypass da API Node.js). */
  readonly url: string;
  /** Quando a URL expira. */
  readonly expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Contrato: IStorageService
// ---------------------------------------------------------------------------

/**
 * Port (interface) para armazenamento de arquivos binários.
 *
 * Abstrai completamente o MinIO (implementação self-hosted compatível com S3).
 * Se no futuro migrar para AWS S3, basta criar `AWSS3StorageAdapter`
 * implementando esta interface — zero alteração no domínio ou na aplicação.
 *
 * DESIGN:
 *   - Presigned URLs para upload/download: o arquivo NÃO passa pelo servidor Node.js,
 *     evitando gargalo de banda e uso de memória (ADR-002 e ADR-014).
 *   - `upload()` existe para operações internas (geração de .zip de offboarding, etc.).
 *   - Paths seguem a convenção: `{clientId}/{sector}/{YYYY-MM}/{fileHash}_{fileName}`
 *
 * TEMPOS PADRÃO DE EXPIRAÇÃO (configuráveis via env):
 *   - Upload presigned URL: 15 minutos
 *   - Download presigned URL: 5 minutos
 */
export interface IStorageService {
  /**
   * Gera uma Presigned URL para o cliente fazer upload DIRETO ao MinIO.
   * O Node.js não toca no conteúdo do arquivo.
   *
   * @param storagePath Caminho completo no bucket (sem bucket name).
   * @param expiresInSeconds Validade da URL em segundos. Padrão: 900 (15min).
   */
  gerarPresignedUrlUpload(
    storagePath: string,
    expiresInSeconds?: number,
  ): Promise<PresignedUrlUpload>;

  /**
   * Gera uma Presigned URL para o cliente fazer download DIRETO do MinIO.
   * Válida por 5 minutos (configurável). Expiração curta = menor janela de vazamento.
   *
   * @param storagePath Caminho completo no bucket.
   * @param expiresInSeconds Validade da URL em segundos. Padrão: 300 (5min).
   * @param fileName Quando fornecido, adiciona `Content-Disposition: attachment; filename="..."` à URL assinada, forçando o browser a salvar o arquivo em vez de abrir inline.
   */
  gerarPresignedUrlDownload(
    storagePath: string,
    expiresInSeconds?: number,
    fileName?: string,
  ): Promise<PresignedUrlDownload>;

  /**
   * Faz upload de um arquivo diretamente pelo servidor (operação interna).
   * Use APENAS para arquivos gerados internamente (zip de offboarding, relatórios).
   * Uploads de usuários devem usar Presigned URLs.
   *
   * @param storagePath Caminho de destino no bucket.
   * @param conteudo Buffer com o conteúdo binário do arquivo.
   * @param contentType MIME type do arquivo (ex: 'application/zip').
   */
  upload(storagePath: string, conteudo: Buffer, contentType: string): Promise<void>;

  /**
   * Remove um arquivo do storage permanentemente.
   * Chamado no offboarding após 5 anos de retenção fiscal.
   *
   * @param storagePath Caminho completo do arquivo no bucket.
   */
  deletar(storagePath: string): Promise<void>;

  /**
   * Remove múltiplos arquivos em uma única operação batch.
   * Mais eficiente que múltiplas chamadas a `deletar()`.
   * Usado no offboarding e na limpeza de lifecycle.
   */
  deletarLote(storagePaths: string[]): Promise<void>;

  /**
   * Verifica se um arquivo existe no bucket.
   * Usado para validar integridade antes de gerar Presigned URL de download.
   */
  verificarExistencia(storagePath: string): Promise<boolean>;

  /**
   * Copia um arquivo para outro path dentro do mesmo bucket.
   * Usado no offboarding para mover arquivos para path dedicado.
   */
  copiar(fromPath: string, toPath: string): Promise<void>;

  /**
   * Baixa um arquivo do storage e retorna seu conteúdo como Buffer.
   * Usado para operações internas que precisam processar o binário
   * (ex: enviar PDF ao DocSeal para assinatura eletrônica).
   *
   * @param storagePath Caminho completo do arquivo no bucket.
   */
  getBuffer(storagePath: string): Promise<Buffer>;
}
