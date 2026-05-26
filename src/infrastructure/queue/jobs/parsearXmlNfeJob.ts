import { prisma } from '@/infrastructure/di/Container';
import { parseNFe } from '@/lib/nfe/nfeParser';
import * as Minio from 'minio';

let _minioClient: Minio.Client | null = null;

function getMinioClient(): Minio.Client {
  if (_minioClient) return _minioClient;
  _minioClient = new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT ?? 'localhost',
    port:      Number(process.env.MINIO_API_PORT ?? 9000),
    useSSL:    process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER ?? '',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? '',
  });
  return _minioClient;
}

async function readMinioObject(bucket: string, path: string): Promise<string> {
  const client = getMinioClient();
  const stream = await client.getObject(bucket, path);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

export interface ParsearXmlNfeJobData {
  documentoId: string;
  storagePath: string;
}

export async function parsearXmlNfeJob(data: ParsearXmlNfeJobData): Promise<void> {
  const { documentoId, storagePath } = data;
  const bucket = process.env.MINIO_BUCKET ?? 'documentos-contabeis';

  let xmlString: string;
  try {
    xmlString = await readMinioObject(bucket, storagePath);
  } catch {
    return;
  }

  const metadata = parseNFe(xmlString);
  if (!metadata) return;

  await prisma.documentoFiscal.update({
    where: { id: documentoId },
    data: { metadataJson: metadata as object },
  });
}
