import { z } from 'zod';
import type {
  ProcessarUploadLoteInputDTO,
  ArquivoUploadInputDTO,
} from '../../../application/dtos/UploadLoteDTO';

// =============================================================================
// Constantes — espelham intencionalmente as regras do use case
//
// Duplicadas aqui para garantir fail-fast na camada HTTP, antes de qualquer
// I/O (DB, MinIO). O use case também as valida — defense in depth.
// =============================================================================

const MAX_FILE_SIZE_BYTES = 10 * 1_048_576; // 10 MB
const MAX_FILES_PER_BATCH = 50;
const ALLOWED_EXTENSIONS = new Set([
  '.xml', '.pdf',
  '.xlsx', '.xls',
  '.docx', '.doc',
  '.csv',
  '.ofx',
  '.ods',
  '.zip', '.rar',
]);

// Mapa de MIME types aceitos (espelha MIME_PARA_FILETYPE do use case)
const ALLOWED_MIME_TYPES = new Set([
  'application/xml',
  'text/xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel',                                          // xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword',                                                // doc
  'text/csv',
  'application/csv',
  'application/x-ofx',
  'application/ofx',
  'application/vnd.oasis.opendocument.spreadsheet',                    // ods
  'application/zip',                                                   // zip
  'application/x-zip-compressed',                                      // zip (Windows)
  'application/x-zip',                                                 // zip (alternativo)
  'application/x-rar-compressed',                                      // rar
  'application/vnd.rar',                                               // rar (moderno)
  'application/x-rar',                                                 // rar (alternativo)
]);

// UUID v4 estrito — garante que clienteId e contadorId são UUIDs reais,
// não strings arbitrárias que poderiam causar injeção de SQL ou SSRF.
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Detecta path traversal: ../, ..\, sequências absolutas /foo, \foo
// Protege contra nomes como "../../etc/passwd" ou "/etc/shadow"
const PATH_TRAVERSAL_REGEX = /(\.\.[/\\])|([/\\]\.\.)|(^[/\\])/;

// =============================================================================
// Schema Zod: campos de texto do FormData
// =============================================================================

const MetadadosLoteSchema = z.object({
  clienteId: z
    .string({ required_error: 'clienteId é obrigatório' })
    .regex(UUID_V4_REGEX, 'clienteId deve ser um UUID v4 válido'),

  sector: z.enum(['FISCAL', 'PESSOAL', 'CONTABIL'], {
    required_error: 'sector é obrigatório',
    invalid_type_error: 'sector deve ser FISCAL, PESSOAL ou CONTABIL',
  }),

  loteId: z
    .string()
    .regex(UUID_V4_REGEX, 'loteId deve ser um UUID v4 válido')
    .optional(),

  // Competência: formato ISO 8601 YYYY-MM-DD ou YYYY-MM
  // Transformado para Date após validação para passar ao DTO
  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'competencia deve estar no formato YYYY-MM ou YYYY-MM-DD')
    .transform((v) => v.length === 7 ? v + '-01' : v) // YYYY-MM → YYYY-MM-01
    .refine(
      (v) => !isNaN(new Date(v).getTime()),
      'competencia não é uma data válida',
    )
    .transform((v) => new Date(v + 'T00:00:00.000Z')) // UTC para evitar drift de fuso
    .optional(),
});

// =============================================================================
// Validação por arquivo (executada ANTES de ler o Buffer — early rejection)
//
// Não faz sanitização silenciosa; rejeita com mensagem de erro descritiva.
// O use case tem a sanitização defensiva própria (gerarStoragePath),
// mas a política desta camada é "rejeitar, não corrigir".
// =============================================================================

function validarArquivo(file: File): string[] {
  const erros: string[] = [];
  const nome = file.name;

  // 1. Null bytes — podem causar truncamento em funções de string estilo-C
  if (nome.includes('\0')) {
    erros.push(`"${nome}": nome contém null bytes`);
  }

  // 2. Path traversal
  if (PATH_TRAVERSAL_REGEX.test(nome)) {
    erros.push(`"${nome}": nome contém tentativa de path traversal`);
  }

  // 3. Comprimento do nome
  if (nome.trim().length === 0) {
    erros.push(`Arquivo sem nome: nome vazio não é permitido`);
  } else if (nome.length > 255) {
    erros.push(`"${nome}": nome excede 255 caracteres`);
  }

  // 4. Extensão — extrai o último segmento após ponto (case-insensitive)
  const partes = nome.split('.');
  const ext = partes.length > 1 ? '.' + partes.at(-1)!.toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    erros.push(
      `"${nome}": extensão "${ext || '(nenhuma)'}" não permitida. ` +
      `Aceitos: .xml, .pdf, .xlsx, .xls, .docx, .doc, .csv, .ofx, .ods, .zip, .rar`,
    );
  }

  // 5. MIME type — a camada HTTP não confia cegamente no browser,
  //    mas esta verificação cobre erros acidentais de seleção de arquivo.
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    erros.push(
      `"${nome}": MIME type "${file.type || '(ausente)'}" não permitido. ` +
      `Aceitos: application/xml, text/xml, application/pdf, xlsx, xls, docx, doc, csv, ofx, ods, zip, rar`,
    );
  }

  // 6. Tamanho
  if (file.size === 0) {
    erros.push(`"${nome}": arquivo está vazio (0 bytes)`);
  } else if (file.size > MAX_FILE_SIZE_BYTES) {
    erros.push(
      `"${nome}": ${(file.size / 1_048_576).toFixed(2)} MB excede o limite de 10 MB`,
    );
  }

  return erros;
}

// =============================================================================
// Tipo de retorno tipado (Railway-Oriented)
// =============================================================================

export type ParsearFormDataResultado =
  | { ok: true; dto: ProcessarUploadLoteInputDTO }
  | { ok: false; erros: string[] };

// =============================================================================
// Função principal: parseia e valida o FormData de upload em lote
//
// FLUXO INTENCIONAL (fail-fast por etapa):
//   1. Valida campos de texto (Zod) — falha imediata, sem tocar nos arquivos
//   2. Verifica quantidade de arquivos (0 ou > 50)
//   3. Valida metadados de cada arquivo (nome, MIME, tamanho) — sem ler o Buffer
//   4. Lê conteúdo binário dos arquivos — SOMENTE após todas as validações passarem
//
// Por que adiar a leitura do Buffer (etapa 4)?
//   Ler 50 arquivos de 10 MB cada = 500 MB de memória desperdiçada se o request
//   é inválido. Validar primeiro, alocar depois.
// =============================================================================

export async function parsearFormDataUploadLote(
  formData: FormData,
  contadorId: string,
  ipAddress: string,
  userAgent: string | undefined,
): Promise<ParsearFormDataResultado> {

  // -------------------------------------------------------------------------
  // Etapa 1: Campos de texto via Zod
  // -------------------------------------------------------------------------
  const parseResult = MetadadosLoteSchema.safeParse({
    clienteId:   formData.get('clienteId'),
    sector:      formData.get('sector'),
    loteId:      formData.get('loteId')      ?? undefined,
    competencia: formData.get('competencia') ?? undefined,
  });

  if (!parseResult.success) {
    const erros = parseResult.error.issues.map(
      (issue) => `Campo "${(issue.path.join('.') || issue.path[0]) ?? 'desconhecido'}": ${issue.message}`,
    );
    return { ok: false, erros };
  }

  const { clienteId, sector, loteId, competencia } = parseResult.data;

  // -------------------------------------------------------------------------
  // Etapa 2: Quantidade de arquivos
  // -------------------------------------------------------------------------
  const allFiles = formData.getAll('arquivos');
  const fileObjects = allFiles.filter((f): f is File => f instanceof File);

  if (fileObjects.length === 0) {
    return {
      ok: false,
      erros: ['O campo "arquivos" é obrigatório e deve conter pelo menos 1 arquivo.'],
    };
  }

  if (fileObjects.length > MAX_FILES_PER_BATCH) {
    return {
      ok: false,
      erros: [
        `O lote contém ${fileObjects.length} arquivos. ` +
        `O limite máximo por requisição é ${MAX_FILES_PER_BATCH}.`,
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Etapa 3: Metadados de cada arquivo (sem ler conteúdo)
  // Coleta TODOS os erros de todos os arquivos antes de rejeitar —
  // melhor UX: o frontend exibe todas as falhas de uma vez.
  // -------------------------------------------------------------------------
  const errosArquivos: string[] = [];
  for (const file of fileObjects) {
    errosArquivos.push(...validarArquivo(file));
  }

  if (errosArquivos.length > 0) {
    return { ok: false, erros: errosArquivos };
  }

  // -------------------------------------------------------------------------
  // Etapa 4: Leitura do conteúdo binário (somente após validação completa)
  // Paralelo controlado: todos os arquivos são lidos concorrentemente,
  // mas apenas após garantirmos que todos são válidos.
  // -------------------------------------------------------------------------
  const arquivos: ArquivoUploadInputDTO[] = await Promise.all(
    fileObjects.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      return {
        fileName:      file.name,
        mimeType:      file.type,
        fileSizeBytes: file.size,
        conteudo:      Buffer.from(arrayBuffer),
        competencia,
      } satisfies ArquivoUploadInputDTO;
    }),
  );

  return {
    ok: true,
    dto: {
      clienteId,
      contadorId,
      sector,
      arquivos,
      loteId,
      ipAddress,
      userAgent,
    } satisfies ProcessarUploadLoteInputDTO,
  };
}
