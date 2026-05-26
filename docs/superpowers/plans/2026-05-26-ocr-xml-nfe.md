# OCR / Parser de XML NF-e Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Quando um XML de NF-e é uploaded, parsear automaticamente os campos-chave (emitente, destinatário, valor, número, data, CFOP, chave de acesso) e armazená-los no `metadataJson` do `DocumentoFiscal`. Exibir esses dados extraídos no painel do documento.

**Architecture:** BullMQ job existente de processamento de uploads dispara o parse após salvar o arquivo no MinIO. O XML NF-e tem estrutura bem definida (sem necessidade de OCR real — é parse de XML). Usamos o parser `fast-xml-parser` (já instalado como dependência transitiva do Prisma). Os dados ficam em `metadataJson` — nenhuma migration necessária.

**Tech Stack:** `fast-xml-parser` (já disponível), BullMQ (já configurado), MinIO (para ler o XML), Prisma

---

## Arquivo Map

| Ação | Arquivo |
|------|---------|
| Create | `src/lib/nfe/nfeParser.ts` |
| Create | `src/infrastructure/queue/jobs/parsearXmlNfeJob.ts` |
| Modify | `src/infrastructure/queue/BullMQAdapter.ts` |
| Create | `app/api/v1/documentos/[id]/metadata/route.ts` |

---

## Task 1: Parser NF-e

**Files:**
- Create: `src/lib/nfe/nfeParser.ts`

- [ ] **Step 1: Criar parser**

```typescript
import { XMLParser } from 'fast-xml-parser';

export interface NFeMetadata {
  chaveAcesso?:    string;
  numero?:         string;
  serie?:          string;
  dataEmissao?:    string; // ISO
  naturezaOp?:     string;
  cfop?:           string;
  valorTotal?:     number;
  // Emitente
  emitenteCnpj?:   string;
  emitenteNome?:   string;
  emitenteUf?:     string;
  // Destinatário
  destinatarioCnpj?: string;
  destinatarioNome?: string;
  // Itens resumidos
  totalItens?:     number;
  descricaoPrincipal?: string; // primeiro item
  // Impostos
  valorIcms?:      number;
  valorPis?:       number;
  valorCofins?:    number;
  valorIss?:       number;
  // Tipo documento
  tipoNfe?:        'NFe' | 'NFCe' | 'NFSe' | 'CTe' | 'outro';
}

export function parseNFe(xmlString: string): NFeMetadata | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes:    false,
      attributeNamePrefix: '@_',
      parseTagValue:       true,
    });
    const obj = parser.parse(xmlString);

    // Suporte a NFe, NFCe, CTe
    const nfeProc = obj.nfeProc ?? obj.NFe ?? obj.nfeProc;
    const nfe     = nfeProc?.NFe ?? obj.NFe;
    const infNFe  = nfe?.infNFe;

    if (!infNFe) {
      // Tentar NFSe (formato não padronizado — retornar básico)
      return { tipoNfe: 'NFSe' };
    }

    const ide  = infNFe.ide  ?? {};
    const emit = infNFe.emit ?? {};
    const dest = infNFe.dest ?? {};
    const total = infNFe.total?.ICMSTot ?? {};
    const det  = Array.isArray(infNFe.det) ? infNFe.det : (infNFe.det ? [infNFe.det] : []);

    const chave = infNFe['@_Id']?.replace(/^NFe/, '') ?? '';

    return {
      chaveAcesso:       chave || undefined,
      numero:            String(ide.nNF ?? ''),
      serie:             String(ide.serie ?? ''),
      dataEmissao:       ide.dhEmi ?? ide.dEmi,
      naturezaOp:        ide.natOp,
      cfop:              det[0]?.prod?.CFOP ? String(det[0].prod.CFOP) : undefined,
      valorTotal:        Number(total.vNF ?? 0) || undefined,
      emitenteCnpj:      emit.CNPJ,
      emitenteNome:      emit.xNome ?? emit.xFant,
      emitenteUf:        emit.enderEmit?.UF,
      destinatarioCnpj:  dest.CNPJ ?? dest.CPF,
      destinatarioNome:  dest.xNome,
      totalItens:        det.length,
      descricaoPrincipal: det[0]?.prod?.xProd,
      valorIcms:         Number(total.vICMS ?? 0) || undefined,
      valorPis:          Number(total.vPIS  ?? 0) || undefined,
      valorCofins:       Number(total.vCOFINS ?? 0) || undefined,
      tipoNfe:           'NFe',
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/nfe/nfeParser.ts
git commit -m "feat(nfe): add NF-e XML parser (chave, emitente, valor, CFOP, impostos)"
```

---

## Task 2: Job BullMQ de parse

**Files:**
- Create: `src/infrastructure/queue/jobs/parsearXmlNfeJob.ts`

- [ ] **Step 1: Ler como o MinIO é usado nos outros jobs**

Leia `src/infrastructure/queue/BullMQAdapter.ts` e os jobs existentes para entender como acessar o MinIO e o Prisma dentro de um job.

- [ ] **Step 2: Criar job**

```typescript
import { prisma } from '@/src/infrastructure/database/prisma';
import { parseNFe } from '@/src/lib/nfe/nfeParser';
import * as Minio from 'minio';

let _minioClient: Minio.Client | null = null;

function getMinioClient(): Minio.Client {
  if (_minioClient) return _minioClient;
  _minioClient = new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT ?? 'localhost',
    port:      Number(process.env.MINIO_PORT ?? 9000),
    useSSL:    process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
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
    // Arquivo pode não existir ainda — ignorar silenciosamente
    return;
  }

  const metadata = parseNFe(xmlString);
  if (!metadata) return;

  await prisma.documentoFiscal.update({
    where: { id: documentoId },
    data: { metadataJson: metadata as object },
  });
}
```

- [ ] **Step 3: Registrar no BullMQ e disparar após upload de XML**

No `BullMQAdapter.ts`, no worker que processa jobs:

```typescript
import { parsearXmlNfeJob } from './jobs/parsearXmlNfeJob';

// No handler do worker:
case 'parsear-xml-nfe':
  await parsearXmlNfeJob(job.data);
  break;
```

No use case de upload (`ProcessarUploadLoteUseCase` ou similar), após salvar o documento com `fileType === 'XML'`, enfileirar:

```typescript
if (arquivo.fileType === 'XML') {
  await queue.add('parsear-xml-nfe', {
    documentoId: documento.id,
    storagePath: documento.storagePath,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/queue/jobs/parsearXmlNfeJob.ts src/infrastructure/queue/BullMQAdapter.ts
git commit -m "feat(nfe): add BullMQ job to auto-parse NF-e XML on upload"
```

---

## Task 3: Rota para expor metadata extraída

**Files:**
- Create: `app/api/v1/documentos/[id]/metadata/route.ts`

- [ ] **Step 1: Criar rota GET**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';

export const GET = withAuth(async (req, { params }) => {
  const { id } = await params;

  const doc = await prisma.documentoFiscal.findUnique({
    where: { id, deletedAt: null },
    select: { metadataJson: true, fileType: true },
  });

  if (!doc) return NextResponse.json({ message: 'Documento não encontrado' }, { status: 404 });
  if (doc.fileType !== 'XML') return NextResponse.json({ message: 'Metadata disponível apenas para XMLs' }, { status: 400 });

  return NextResponse.json({ metadata: doc.metadataJson });
}, ['ACCOUNTANT', 'CLIENT', 'EMPLOYEE', 'ADMIN']);
```

- [ ] **Step 2: Commit**

```bash
git add app/api/v1/documentos/\[id\]/metadata/
git commit -m "feat(nfe): expose extracted NF-e metadata via GET /documentos/:id/metadata"
```

---

## Task 4: Exibir metadata no painel de documento

- [ ] **Step 1: Encontrar o componente de detalhe de documento**

Procure em `app/(contador)/clientes/[id]/` ou similar onde documentos são exibidos.

- [ ] **Step 2: Adicionar painel de "Dados Extraídos" para XMLs**

Ao carregar um documento com `fileType === 'XML'`, fazer GET em `/api/v1/documentos/{id}/metadata` e exibir:

```tsx
{metadata && (
  <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
    <h3 className="font-semibold text-sm">Dados Extraídos da NF-e</h3>
    <div className="grid grid-cols-2 gap-2 text-sm">
      {metadata.emitenteNome && <div><span className="text-muted-foreground">Emitente:</span> {metadata.emitenteNome}</div>}
      {metadata.destinatarioNome && <div><span className="text-muted-foreground">Destinatário:</span> {metadata.destinatarioNome}</div>}
      {metadata.numero && <div><span className="text-muted-foreground">Nº NF-e:</span> {metadata.numero}</div>}
      {metadata.valorTotal && <div><span className="text-muted-foreground">Valor Total:</span> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metadata.valorTotal)}</div>}
      {metadata.dataEmissao && <div><span className="text-muted-foreground">Emissão:</span> {new Date(metadata.dataEmissao).toLocaleDateString('pt-BR')}</div>}
      {metadata.cfop && <div><span className="text-muted-foreground">CFOP:</span> {metadata.cfop}</div>}
      {metadata.chaveAcesso && <div className="col-span-2"><span className="text-muted-foreground">Chave:</span> <span className="font-mono text-xs">{metadata.chaveAcesso}</span></div>}
    </div>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat(nfe): display extracted NF-e metadata in document detail panel"
```

---

## Verificação final

- [ ] Upload de XML de NF-e → aguardar job → GET /metadata retorna dados corretos
- [ ] Upload de PDF → GET /metadata retorna 400
- [ ] XML malformado → job não falha (retorna silenciosamente)
- [ ] `npm run build` sem erros
