import { NextRequest, NextResponse } from 'next/server';

import { withAuth } from '../../../../../src/infrastructure/http/middlewares/withAuth';
import { logger }   from '../../../../../src/utils/logger';
import { parseNFe, type NFeParseResult } from '../../../../../src/utils/nfeParser';

// =============================================================================
// Configuração do runtime Next.js
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// Constantes de validação
// =============================================================================

const MAX_ARQUIVOS  = 20;
const MAX_TAMANHO   = 2 * 1024 * 1024; // 2 MB por arquivo

// =============================================================================
// Tipos de resposta
// =============================================================================

interface ResultadoArquivo {
  nomeArquivo: string;
  ok:          boolean;
  dados?:      NFeParseResult;
  erro?:       string;
}

// =============================================================================
// POST /api/v1/nfe/importar
//
// Recebe multipart/form-data com campo "arquivos" (um ou múltiplos XMLs).
// Para cada arquivo, faz parse do NF-e XML e retorna os dados estruturados.
//
// Headers obrigatórios:
//   Authorization: Bearer <jwt>
//   Content-Type:  multipart/form-data
//
// Body (form-data):
//   arquivos: File | File[]  — XMLs de NF-e, máx 20 arquivos, 2 MB cada
//
// Respostas:
//   200 OK               → { resultados: ResultadoArquivo[] }
//   400 Bad Request      → { ok: false, error: string }
//   401 Unauthorized     → { message: string }
//   403 Forbidden        → { message: string }
//   500 Internal Error   → { ok: false, error: string }
// =============================================================================

export const POST = withAuth(async (req: NextRequest): Promise<NextResponse> => {

  // -------------------------------------------------------------------------
  // 1. Parse do FormData
  // -------------------------------------------------------------------------
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Corpo da requisição inválido. Esperado: multipart/form-data com campo "arquivos".' },
      { status: 400 },
    );
  }

  // -------------------------------------------------------------------------
  // 2. Coleta dos arquivos
  // -------------------------------------------------------------------------
  const arquivosRaw = formData.getAll('arquivos');

  if (!arquivosRaw || arquivosRaw.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Nenhum arquivo enviado. Inclua ao menos um XML no campo "arquivos".' },
      { status: 400 },
    );
  }

  if (arquivosRaw.length > MAX_ARQUIVOS) {
    return NextResponse.json(
      { ok: false, error: `Limite de ${MAX_ARQUIVOS} arquivos por requisição excedido.` },
      { status: 400 },
    );
  }

  // -------------------------------------------------------------------------
  // 3. Processamento de cada arquivo
  // -------------------------------------------------------------------------
  const resultados: ResultadoArquivo[] = [];

  for (const entry of arquivosRaw) {
    // Garante que é um File, não uma string
    if (typeof entry === 'string') {
      resultados.push({ nomeArquivo: '(campo de texto)', ok: false, erro: 'Esperado um arquivo, recebido texto.' });
      continue;
    }

    const arquivo = entry as File;
    const nomeArquivo = arquivo.name ?? 'desconhecido.xml';

    // Validação de tamanho
    if (arquivo.size > MAX_TAMANHO) {
      resultados.push({
        nomeArquivo,
        ok:   false,
        erro: `Arquivo excede o limite de ${MAX_TAMANHO / (1024 * 1024)} MB.`,
      });
      continue;
    }

    // Leitura do texto
    let xmlString: string;
    try {
      xmlString = await arquivo.text();
    } catch (err) {
      logger.error('[POST /nfe/importar] Falha ao ler arquivo', err instanceof Error ? err : undefined);
      resultados.push({ nomeArquivo, ok: false, erro: 'Não foi possível ler o conteúdo do arquivo.' });
      continue;
    }

    // Parse do NF-e
    try {
      const dados = parseNFe(xmlString);
      resultados.push({ nomeArquivo, ok: true, dados });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido ao processar o XML.';
      logger.error(`[POST /nfe/importar] Parse falhou para "${nomeArquivo}": ${mensagem}`);
      resultados.push({ nomeArquivo, ok: false, erro: mensagem });
    }
  }

  return NextResponse.json({ resultados });

}, ['ACCOUNTANT', 'EMPLOYEE']);
