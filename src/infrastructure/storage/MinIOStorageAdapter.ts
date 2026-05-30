import { Client as MinioClient, CopyConditions } from 'minio';
import type {
  IStorageService,
  PresignedUrlUpload,
  PresignedUrlDownload,
} from '../../domain/ports/IStorageService';

// =============================================================================
// MinIOStorageAdapter
//
// Adaptador concreto de IStorageService para o MinIO (S3-compatível, self-hosted).
// Se o projeto migrar para AWS S3, cria-se AWSS3StorageAdapter implementando a
// mesma interface — zero alteração no domínio ou nos use cases.
//
// THREAD-SAFETY: MinioClient é thread-safe e pode ser compartilhado como singleton.
// RECONEXÃO: O SDK do MinIO gerencia reconexões HTTP automaticamente.
// =============================================================================

export class MinIOStorageAdapter implements IStorageService {
  constructor(
    private readonly client: MinioClient,
    private readonly bucket: string,
  ) {}

  // ---------------------------------------------------------------------------
  // upload — usado internamente (offboarding, geração de ZIPs)
  // Uploads de usuários devem usar Presigned URLs para não passar pelo servidor
  // ---------------------------------------------------------------------------

  async upload(
    storagePath: string,
    conteudo: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.putObject(
      this.bucket,
      storagePath,
      conteudo,
      conteudo.length,
      { 'Content-Type': contentType },
    );
  }

  // ---------------------------------------------------------------------------
  // Presigned URL de upload (cliente faz PUT direto no MinIO — sem passar pelo Node.js)
  // ---------------------------------------------------------------------------

  async gerarPresignedUrlUpload(
    storagePath: string,
    expiresInSeconds = 900, // 15 minutos
  ): Promise<PresignedUrlUpload> {
    const url = await this.client.presignedPutObject(
      this.bucket,
      storagePath,
      expiresInSeconds,
    );

    return {
      url,
      expiresAt:  new Date(Date.now() + expiresInSeconds * 1_000),
      storageKey: storagePath,
    };
  }

  // ---------------------------------------------------------------------------
  // Presigned URL de download (5 min — janela curta reduz risco de vazamento)
  // ---------------------------------------------------------------------------

  async gerarPresignedUrlDownload(
    storagePath: string,
    expiresInSeconds = 300, // 5 minutos
  ): Promise<PresignedUrlDownload> {
    const url = await this.client.presignedGetObject(
      this.bucket,
      storagePath,
      expiresInSeconds,
    );

    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1_000),
    };
  }

  // ---------------------------------------------------------------------------
  // deletar — remoção permanente (chamado no offboarding após retenção fiscal)
  // ---------------------------------------------------------------------------

  async deletar(storagePath: string): Promise<void> {
    await this.client.removeObject(this.bucket, storagePath);
  }

  // ---------------------------------------------------------------------------
  // deletarLote — batch delete (mais eficiente que múltiplos deletar())
  // ---------------------------------------------------------------------------

  async deletarLote(storagePaths: string[]): Promise<void> {
    if (storagePaths.length === 0) return;

    // MinIO SDK espera ReadableStream ou array de {name, versionId?}
    const objectsList = storagePaths.map((name) => ({ name }));
    await this.client.removeObjects(this.bucket, objectsList);
  }

  // ---------------------------------------------------------------------------
  // verificarExistencia — valida existência antes de gerar presigned URL
  // ---------------------------------------------------------------------------

  async verificarExistencia(storagePath: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, storagePath);
      return true;
    } catch (err: unknown) {
      // MinIO lança erro com code 'NoSuchKey' ou 'NotFound' para objetos inexistentes
      if (isMinioNotFoundError(err)) {
        return false;
      }
      // Re-lança erros de rede, permissão ou configuração
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // copiar — move arquivo para outro path no mesmo bucket (offboarding)
  // ---------------------------------------------------------------------------

  async copiar(fromPath: string, toPath: string): Promise<void> {
    const cond = new CopyConditions();
    // Formato do sourcePath esperado pelo MinIO SDK: "/{bucket}/{objectName}"
    await this.client.copyObject(
      this.bucket,
      toPath,
      `/${this.bucket}/${fromPath}`,
      cond,
    );
  }

  // ---------------------------------------------------------------------------
  // getBuffer — download de arquivo como Buffer para processamento interno
  // ---------------------------------------------------------------------------

  async getBuffer(storagePath: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, storagePath);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        stream.destroy();
        reject(new Error(`Timeout reading ${storagePath} from storage`));
      }, 30_000);

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks));
      });
      stream.on('error', (err: Error) => {
        clearTimeout(timeout);
        stream.destroy();
        reject(new Error(`Failed to read ${storagePath}: ${err.message}`));
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Helper privado: detecta erros de "objeto não encontrado" do MinIO SDK
// ---------------------------------------------------------------------------

function isMinioNotFoundError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code;
  // Códigos possíveis dependendo da versão do SDK e da operação
  return code === 'NoSuchKey' || code === 'NotFound' || code === 'NoSuchObject';
}
