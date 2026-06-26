import { PDFDocument } from 'pdf-lib';

/**
 * Re-salva um PDF usando pdf-lib, corrigindo problemas estruturais que causam
 * páginas em branco no Firefox PDF.js (incompatibilidade com PDFs do pypdf).
 *
 * Se o arquivo não for um PDF válido ou a normalização falhar, retorna o
 * buffer original sem lançar erro — o upload prossegue normalmente.
 */
export async function normalizarPdfBuffer(buffer: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata:   false,
    });
    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  } catch {
    return buffer;
  }
}
