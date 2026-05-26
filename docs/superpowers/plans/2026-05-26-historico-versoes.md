# Histórico de Versões de Documento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Quando um novo arquivo com mesmo nome e cliente é enviado (mas hash diferente), criar uma nova versão em vez de substituir. Manter todas as versões no MinIO e exibir histórico com opção de download de versão anterior.

**Architecture:** Novo model `DocumentoVersao` rastreia cada versão de um documento. Ao fazer upload com mesmo `fileName + clientId`, o use case detecta colisão de nome (não de hash) e cria versão 2, 3, etc. A versão atual é a de número mais alto. Versões antigas ficam no MinIO com path versionado.

**Tech Stack:** Prisma, MinIO, Next.js — sem dependências novas.

---

## Arquivo Map

| Ação | Arquivo |
|------|---------|
| Modify | `prisma/schema.prisma` |
| Create | `app/api/v1/documentos/[id]/versoes/route.ts` |
| Modify | `src/application/usecases/ProcessarUploadLoteUseCase.ts` |
| Modify | `app/api/v1/documentos/[id]/download/route.ts` |

---

## Task 1: Schema — DocumentoVersao

- [ ] **Step 1: Adicionar model**

Em `prisma/schema.prisma`, adicionar após `model DocumentoFiscal`:

```prisma
// Versões de um documento fiscal.
// Versão 1 é criada junto com o DocumentoFiscal.
// Versões 2, 3... são criadas quando o mesmo arquivo (fileName + clientId) é reenviado.
model DocumentoVersao {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  documentoId   String   @map("documento_id") @db.Uuid
  versao        Int      // 1, 2, 3...
  storagePath   String   @map("storage_path") @db.VarChar(1000)
  fileHash      String   @map("file_hash") @db.Char(64)
  fileSizeBytes BigInt   @map("file_size_bytes")
  uploadedById  String   @map("uploaded_by_id") @db.Uuid
  motivo        String?  @db.VarChar(500) // opcional: razão para nova versão
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz

  documento DocumentoFiscal @relation(fields: [documentoId], references: [id], onDelete: Cascade)

  @@unique([documentoId, versao])
  @@index([documentoId])
  @@map("documento_versao")
}
```

Adicionar relação em `DocumentoFiscal`:

```prisma
  versoes DocumentoVersao[]
  versaoAtual Int @default(1) @map("versao_atual")
```

- [ ] **Step 2: Migrar**

```bash
npx prisma migrate dev --name add_documento_versao
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(versoes): add DocumentoVersao table and versaoAtual field"
```

---

## Task 2: Atualizar use case de upload para criar versões

**Files:**
- Modify: `src/application/usecases/ProcessarUploadLoteUseCase.ts`

- [ ] **Step 1: Ler o use case atual**

Leia `src/application/usecases/ProcessarUploadLoteUseCase.ts` para entender o fluxo.

- [ ] **Step 2: Adicionar lógica de versionamento**

No use case, após salvar o arquivo no MinIO e antes de criar o `DocumentoFiscal`, verificar se já existe documento com mesmo `fileName + clientId`:

```typescript
// Verificar se existe documento com mesmo nome (possível nova versão)
const existente = await this.documentoRepository.buscarPorNomeECliente(
  arquivo.fileName,
  input.clienteId,
);

if (existente) {
  // Nova versão do documento existente
  const novaVersao = existente.versaoAtual + 1;
  const novoStoragePath = `${input.clienteId}/v${novaVersao}/${arquivo.fileName}`;

  // Upload no MinIO com path versionado
  await this.storageService.upload(novoStoragePath, arquivo.buffer, arquivo.mimeType);

  // Criar registro de versão
  await this.documentoRepository.criarVersao({
    documentoId:   existente.id,
    versao:        novaVersao,
    storagePath:   novoStoragePath,
    fileHash:      arquivo.hash,
    fileSizeBytes: BigInt(arquivo.sizeBytes),
    uploadedById:  input.contadorId,
  });

  // Atualizar documento principal com nova versão atual
  await this.documentoRepository.atualizarVersaoAtual(existente.id, novaVersao, novoStoragePath);

  continue; // pular criação de novo DocumentoFiscal
}

// Documento novo — fluxo normal, mas criar versão 1 também
// ... criação normal do DocumentoFiscal ...
// Após criar, criar versão 1:
await this.documentoRepository.criarVersao({
  documentoId:   novoDocumento.id,
  versao:        1,
  storagePath:   novoDocumento.storagePath,
  fileHash:      novoDocumento.fileHash,
  fileSizeBytes: novoDocumento.fileSizeBytes,
  uploadedById:  input.contadorId,
});
```

- [ ] **Step 3: Adicionar métodos no repositório**

No `IDocumentoRepository` e `PrismaDocumentoRepository`:
- `buscarPorNomeECliente(fileName: string, clienteId: string): Promise<DocumentoFiscal | null>`
- `criarVersao(data: CriarVersaoInput): Promise<void>`
- `atualizarVersaoAtual(id: string, versao: number, storagePath: string): Promise<void>`

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat(versoes): create new version on duplicate filename upload instead of replacing"
```

---

## Task 3: Rota de histórico de versões

**Files:**
- Create: `app/api/v1/documentos/[id]/versoes/route.ts`

- [ ] **Step 1: Criar rota GET**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';

export const GET = withAuth(async (req, { params }) => {
  const { id } = await params;

  const versoes = await prisma.documentoVersao.findMany({
    where: { documentoId: id },
    orderBy: { versao: 'desc' },
    select: {
      id: true,
      versao: true,
      fileHash: true,
      fileSizeBytes: true,
      uploadedById: true,
      motivo: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ versoes: versoes.map((v) => ({
    ...v,
    fileSizeBytes: v.fileSizeBytes.toString(),
  })) });
}, ['ACCOUNTANT', 'CLIENT', 'EMPLOYEE', 'ADMIN']);
```

- [ ] **Step 2: Rota de download por versão**

Criar `app/api/v1/documentos/[id]/versoes/[versao]/download/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/src/infrastructure/http/middlewares/withAuth';
import { prisma } from '@/src/infrastructure/database/prisma';
import { Container } from '@/src/infrastructure/di/Container';

export const GET = withAuth(async (req, { params }) => {
  const { id, versao } = await params;
  const versaoNum = parseInt(versao, 10);

  const registro = await prisma.documentoVersao.findUnique({
    where: { documentoId_versao: { documentoId: id, versao: versaoNum } },
  });

  if (!registro) return NextResponse.json({ message: 'Versão não encontrada' }, { status: 404 });

  const container = Container.getInstance();
  const storage   = container.storageService;
  const bucket    = process.env.MINIO_BUCKET ?? 'documentos-contabeis';

  const url = await storage.gerarPresignedUrlDownload(registro.storagePath, 300);

  return NextResponse.json({ url, expiresAt: new Date(Date.now() + 300_000).toISOString() });
}, ['ACCOUNTANT', 'CLIENT', 'EMPLOYEE', 'ADMIN']);
```

- [ ] **Step 3: Commit**

```bash
git add app/api/v1/documentos/\[id\]/versoes/
git commit -m "feat(versoes): add GET /documentos/:id/versoes and download by version routes"
```

---

## Task 4: Exibir histórico no painel de documento

- [ ] **Step 1: Encontrar componente de detalhe**

Encontre onde documentos são exibidos no painel do contador.

- [ ] **Step 2: Adicionar painel de versões**

```tsx
// Buscar versões ao carregar documento
const { data: versoesData } = useSWR(`/api/v1/documentos/${doc.id}/versoes`);
const versoes = versoesData?.versoes ?? [];

{versoes.length > 1 && (
  <div className="border rounded-lg p-4">
    <h3 className="font-semibold text-sm mb-3">Histórico de Versões ({versoes.length})</h3>
    <div className="space-y-2">
      {versoes.map((v) => (
        <div key={v.id} className="flex items-center justify-between text-sm">
          <div>
            <span className="font-medium">v{v.versao}</span>
            {v.versao === doc.versaoAtual && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Atual</span>}
            <span className="text-muted-foreground ml-2">{new Date(v.createdAt).toLocaleDateString('pt-BR')}</span>
          </div>
          <button
            onClick={() => window.open(`/api/v1/documentos/${doc.id}/versoes/${v.versao}/download`)}
            className="text-blue-600 hover:underline text-xs"
          >
            Baixar
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat(versoes): show version history panel in document detail"
```

---

## Verificação final

- [ ] Upload do mesmo arquivo duas vezes → segunda cria versão 2
- [ ] GET /versoes retorna 2 registros
- [ ] Download de versão 1 retorna URL do arquivo original
- [ ] `npm run build` sem erros
