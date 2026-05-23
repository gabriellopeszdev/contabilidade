import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import _fontkit from '@pdf-lib/fontkit';
import _QRCode from 'qrcode';

// Workaround: default exports empacotados como { default: ... } pelo Webpack/Next.js
const fontkit = (_fontkit as unknown as { default: typeof _fontkit }).default ?? _fontkit;
const QRCode  = (_QRCode as unknown as { default: typeof _QRCode }).default ?? _QRCode;

// =============================================================================
// gerarBoletoPdf — Layout FEBRABAN Premium / Ficha de Compensação
//
// Grid FEBRABAN clássico (Bradesco 237-2) com refinamento visual:
// linhas finas em cinza médio, tipografia hierárquica, logos vetorizados,
// código de barras nítido e rodapé discreto.
//
// Fonte primária: Ubuntu TTF (pdf-lib.js.org) — suporta UTF-8/PT-BR.
// Fallback: Helvetica (StandardFonts) com sanitização de acentos.
// =============================================================================

// ---------------------------------------------------------------------------
// Cache de fonte
// ---------------------------------------------------------------------------
let _ubuntuRegular: ArrayBuffer | null = null;
let _ubuntuBold:    ArrayBuffer | null = null;

const UBUNTU_REGULAR_URL = 'https://pdf-lib.js.org/assets/ubuntu/Ubuntu-R.ttf';
const UBUNTU_BOLD_URL    = 'https://pdf-lib.js.org/assets/ubuntu/Ubuntu-B.ttf';

async function fetchTTF(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (pdf-generator)' },
  });
  if (!res.ok) throw new Error(`Falha ao baixar fonte TTF: ${res.status} ${url}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 1000) throw new Error(`Fonte TTF inválida (${buf.byteLength} bytes): ${url}`);
  return buf;
}

async function getCustomFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer } | null> {
  try {
    if (!_ubuntuRegular || !_ubuntuBold) {
      const [r, b] = await Promise.all([
        fetchTTF(UBUNTU_REGULAR_URL),
        fetchTTF(UBUNTU_BOLD_URL),
      ]);
      _ubuntuRegular = r;
      _ubuntuBold    = b;
    }
    return { regular: _ubuntuRegular, bold: _ubuntuBold };
  } catch {
    _ubuntuRegular = null;
    _ubuntuBold    = null;
    return null;
  }
}

/** Remove acentos para fallback com Helvetica. */
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface BoletoPdfData {
  nomeEscritorio: string;
  clienteNome:    string;
  clienteCnpj:    string;
  valor:          number;
  vencimento:     Date;
  mesReferencia:  string;
  descricao?:     string | null;
  boletoId:       string;
}

// ---------------------------------------------------------------------------
// Paleta de cores refinada
// ---------------------------------------------------------------------------
const BLACK      = rgb(0.08, 0.08, 0.08);   // quase preto, mais suave
const DARK       = rgb(0.2, 0.2, 0.2);      // texto primário
const MEDIUM     = rgb(0.42, 0.42, 0.42);   // labels e bordas
const LIGHT      = rgb(0.62, 0.62, 0.62);   // texto secundário
const VERY_LIGHT = rgb(0.82, 0.82, 0.82);   // linhas internas finas
const BG_SUBTLE  = rgb(0.96, 0.96, 0.96);   // fundo sutil de destaque

// Espessuras de linha
const LINE_THIN    = 0.4;   // linhas internas do grid
const LINE_MEDIUM  = 0.8;   // divisórias de seção
const LINE_THICK   = 1.8;   // separadores verticais pesados (coluna dir, header)
const LINE_OUTER   = 1.2;   // contorno externo

// Tamanhos de fonte
const SZ_LABEL     = 6;     // rótulos pequenos
const SZ_DATA      = 9.5;   // dados normais
const SZ_DATA_LG   = 11;    // dados destacados (valor, vencimento)
const SZ_BANK_NAME = 15;    // nome do banco
const SZ_BANK_CODE = 16;    // código do banco (maior)
const SZ_LD        = 9.5;   // linha digitável

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('pt-BR');
}
function mesLabel(mes: string) {
  const [y, m] = mes.split('-');
  const n = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
             'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${n[parseInt(m, 10) - 1]}/${y}`;
}
function sanitize(str: string) { return str.replace(/[^\u0000-\u024F]/g, ''); }
function nossoNumero(id: string) {
  return `06/${id.replace(/-/g, '').slice(0, 10).padEnd(10, '0')}-4`;
}
function linhaDigitavel(id: string) {
  const d = id.replace(/-/g, '').replace(/[^0-9a-fA-F]/g, '0').padEnd(47, '0').slice(0, 47);
  return [
    d.slice(0, 5) + '.' + d.slice(5, 10),
    d.slice(10, 15) + '.' + d.slice(15, 21),
    d.slice(21, 26) + '.' + d.slice(26, 32),
    d.slice(32, 33),
    d.slice(33, 47),
  ].join('  ');
}
function codigoBarrasNum(id: string) {
  const d = id.replace(/-/g, '').padEnd(44, '0').slice(0, 44);
  return `23791.${d.slice(0, 5)} ${d.slice(5, 15)} ${d.slice(15, 25)} ${d.slice(25, 35)} ${d.slice(35, 44)}`;
}

// ---------------------------------------------------------------------------
// Primitivas de desenho
// ---------------------------------------------------------------------------
function hline(page: PDFPage, x: number, y: number, w: number, t = LINE_THIN, c = VERY_LIGHT) {
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: t, color: c });
}
function vline(page: PDFPage, x: number, y1: number, y2: number, t = LINE_THIN, c = VERY_LIGHT) {
  page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: t, color: c });
}

/** Célula FEBRABAN: rótulo pequeno no topo + valor abaixo. */
function cell(
  page: PDFPage,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  fontLabel: PDFFont, fontValue: PDFFont,
  opts: {
    vSize?: number; lSize?: number;
    rightAlign?: boolean;
    drawBorder?: boolean;
    borderColor?: typeof BLACK;
  } = {},
) {
  const {
    vSize = SZ_DATA, lSize = SZ_LABEL,
    rightAlign = false, drawBorder = true,
    borderColor = VERY_LIGHT,
  } = opts;

  if (drawBorder) {
    page.drawRectangle({
      x, y, width: w, height: h,
      borderColor, borderWidth: LINE_THIN,
    });
  }

  if (label) {
    page.drawText(label, {
      x: x + 3, y: y + h - lSize - 2.5,
      font: fontLabel, size: lSize, color: MEDIUM,
    });
  }

  if (value) {
    const tw = rightAlign ? fontValue.widthOfTextAtSize(value, vSize) : 0;
    page.drawText(value, {
      x: rightAlign ? x + w - tw - 5 : x + 3.5,
      y: y + 4,
      font: fontValue, size: vSize, color: DARK,
    });
  }
}

// ---------------------------------------------------------------------------
// Logo vetorial do banco (escudo estilizado MVP)
// ---------------------------------------------------------------------------
function drawBankLogo(page: PDFPage, cx: number, cy: number, size: number, font: PDFFont) {
  const r = size / 2;
  // Escudo: retângulo + ponta inferior
  page.drawRectangle({
    x: cx - r, y: cy - r * 0.3,
    width: r * 2, height: r * 1.5,
    borderColor: BLACK, borderWidth: 1.2,
  });
  page.drawLine({ start: { x: cx - r, y: cy - r * 0.3 }, end: { x: cx, y: cy - r * 1.1 }, thickness: 1.2, color: BLACK });
  page.drawLine({ start: { x: cx + r, y: cy - r * 0.3 }, end: { x: cx, y: cy - r * 1.1 }, thickness: 1.2, color: BLACK });
  // Preenchimento superior sutil
  page.drawRectangle({
    x: cx - r + 0.6, y: cy + r * 0.2,
    width: r * 2 - 1.2, height: r * 0.95,
    color: BG_SUBTLE,
  });
  // "M" centralizado no escudo
  const mW = font.widthOfTextAtSize('M', size * 0.52);
  page.drawText('M', {
    x: cx - mW / 2, y: cy - r * 0.15,
    font, size: size * 0.52, color: BLACK,
  });
}

// ---------------------------------------------------------------------------
// Monograma do cedente (oval com iniciais)
// ---------------------------------------------------------------------------
function drawCedenteMonogram(
  page: PDFPage, cx: number, cy: number, r: number,
  initials: string, font: PDFFont,
) {
  page.drawEllipse({
    x: cx, y: cy,
    xScale: r * 1.15, yScale: r,
    borderColor: MEDIUM, borderWidth: 0.6,
  });
  const tw = font.widthOfTextAtSize(initials, r * 0.85);
  page.drawText(initials, {
    x: cx - tw / 2, y: cy - r * 0.3,
    font, size: r * 0.85, color: DARK,
  });
}

// ---------------------------------------------------------------------------
// Gerador principal
// ---------------------------------------------------------------------------
export async function gerarBoletoPdf(data: BoletoPdfData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  let fR: PDFFont;
  let fB: PDFFont;
  let useFallback = false;

  const customFonts = await getCustomFonts();
  if (customFonts) {
    try {
      pdfDoc.registerFontkit(fontkit);
      fR = await pdfDoc.embedFont(customFonts.regular);
      fB = await pdfDoc.embedFont(customFonts.bold);
    } catch {
      useFallback = true;
      fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
      fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
  } else {
    useFallback = true;
    fR = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const t = (text: string) => {
    const clean = sanitize(text);
    return useFallback ? stripAccents(clean) : clean;
  };

  // A4 portrait
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width } = page.getSize();

  // Dados
  const escritorio  = t(data.nomeEscritorio);
  const clienteNome = t(data.clienteNome);
  const cnpj        = t(data.clienteCnpj);
  const desc        = t(data.descricao?.trim() || 'Honorários contábeis mensais');

  // Iniciais do escritório para o monograma
  const initials = escritorio.split(/[\s&]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  // =========================================================================
  // Layout constants
  // =========================================================================
  const ML  = 30;
  const W   = width - 60;       // ~535pt
  const RCW = 152;              // coluna direita
  const LCW = W - RCW;          // coluna esquerda

  const H_HEAD = 36;
  const H_R1   = 26;
  const H_R2   = 28;
  const H_R3   = 26;
  const H_R4   = 26;
  const H_R5   = 140;
  const H_R6   = 56;
  const H_FOOT = 16;
  const H_BAR  = 52;

  const Y_TOP = 778;
  const yHead = Y_TOP - H_HEAD;
  const yR1   = yHead - H_R1;
  const yR2   = yR1   - H_R2;
  const yR3   = yR2   - H_R3;
  const yR4   = yR3   - H_R4;
  const yR5   = yR4   - H_R5;
  const yR6   = yR5   - H_R6;
  const yFoot = yR6   - H_FOOT;
  const yBar  = yFoot - 14 - H_BAR;

  // =========================================================================
  // Fundo sutil do documento (textura simulada)
  // =========================================================================
  page.drawRectangle({
    x: ML - 6, y: yBar - 50,
    width: W + 12, height: Y_TOP - yBar + 70,
    color: rgb(0.985, 0.985, 0.985),
  });

  // =========================================================================
  // Linha tracejada de recorte
  // =========================================================================
  const yCut = Y_TOP + 12;
  for (let dx = 0; dx < W; dx += 6) {
    page.drawLine({
      start: { x: ML + dx,     y: yCut },
      end:   { x: ML + dx + 3, y: yCut },
      thickness: 0.35, color: LIGHT,
    });
  }
  page.drawText(useFallback ? '-8<-' : '\u2702', {
    x: ML - 14, y: yCut - 3.5, font: fR, size: 9, color: LIGHT,
  });

  // =========================================================================
  // BORDA EXTERNA
  // =========================================================================
  const gridH = Y_TOP - yFoot;
  page.drawRectangle({
    x: ML, y: yFoot,
    width: W, height: gridH,
    borderColor: MEDIUM, borderWidth: LINE_OUTER,
  });

  // Separador GROSSO da coluna direita (só de ROW1 ao footer — não invade o header)
  vline(page, ML + LCW, yFoot, yHead, LINE_THICK, MEDIUM);

  // =========================================================================
  // HEADER — [ Logo + Banco MVP ] | [ 237-2 ] | [ Linha Digitável ]
  // =========================================================================
  hline(page, ML, yHead, W, LINE_MEDIUM, MEDIUM);

  const bankBlockW = 160;
  const codeBlockW = 58;

  vline(page, ML + bankBlockW,              yHead, Y_TOP, LINE_THICK, MEDIUM);
  vline(page, ML + bankBlockW + codeBlockW, yHead, Y_TOP, LINE_THICK, MEDIUM);

  // (a) Logo + Nome do banco
  const logoX = ML + 20;
  const logoY = yHead + H_HEAD / 2 + 2;
  drawBankLogo(page, logoX, logoY, 22, fB);

  page.drawText('Banco MVP', {
    x: ML + 42, y: yHead + H_HEAD / 2 - 4,
    font: fB, size: SZ_BANK_NAME, color: BLACK,
  });

  // (b) Código do banco
  const codeStr = '237-2';
  const codeW   = fB.widthOfTextAtSize(codeStr, SZ_BANK_CODE);
  page.drawText(codeStr, {
    x: ML + bankBlockW + (codeBlockW - codeW) / 2,
    y: yHead + H_HEAD / 2 - 5,
    font: fB, size: SZ_BANK_CODE, color: BLACK,
  });

  // (c) Linha digitável
  const ld  = linhaDigitavel(data.boletoId);
  const ldW = fB.widthOfTextAtSize(ld, SZ_LD);
  page.drawText(ld, {
    x: ML + W - ldW - 5,
    y: yHead + H_HEAD / 2 - 3.5,
    font: fB, size: SZ_LD, color: DARK,
  });

  // =========================================================================
  // ROW 1 — Local de pagamento | Vencimento
  // =========================================================================
  hline(page, ML, yR1, W, LINE_THIN, VERY_LIGHT);

  cell(page, ML,       yR1, LCW, H_R1,
    'Local de pagamento',
    t('PAGÁVEL PREFERENCIALMENTE NAS AGÊNCIAS DO BANCO MVP'),
    fR, fR, { vSize: 7.5, drawBorder: false });

  cell(page, ML + LCW, yR1, RCW, H_R1,
    'Vencimento',
    fmtDate(data.vencimento),
    fR, fB, { vSize: SZ_DATA_LG, rightAlign: true, drawBorder: false });

  // =========================================================================
  // ROW 2 — Cedente | Agência / Código cedente
  // =========================================================================
  hline(page, ML, yR2, W, LINE_THIN, VERY_LIGHT);

  // Label + monograma + nome
  page.drawText('Cedente', {
    x: ML + 3, y: yR2 + H_R2 - SZ_LABEL - 2.5,
    font: fR, size: SZ_LABEL, color: MEDIUM,
  });

  const monoX = ML + 18;
  const monoY = yR2 + 9;
  drawCedenteMonogram(page, monoX, monoY, 8, initials, fB);

  page.drawText(escritorio, {
    x: ML + 32, y: yR2 + 5,
    font: fB, size: 10.5, color: DARK,
  });

  cell(page, ML + LCW, yR2, RCW, H_R2,
    'Agência / Código cedente',
    '1111-8/00022222-5',
    fR, fR, { vSize: SZ_DATA, rightAlign: true, drawBorder: false });

  // =========================================================================
  // ROW 3 — Data doc | Nº doc | Espécie | Aceite | Data proc | Nosso nº
  // =========================================================================
  hline(page, ML, yR3, W, LINE_THIN, VERY_LIGHT);

  const r3: [string, string, number][] = [
    ['Data do documento',  fmtDate(new Date()),          82],
    ['Nº documento',       data.boletoId.slice(0, 10),   82],
    ['Espécie doc.',       'N',                           50],
    ['Aceite',             'N',                           36],
    ['Data processamento', fmtDate(new Date()),          LCW - 82 - 82 - 50 - 36],
  ];
  let cx3 = ML;
  for (const [lbl, val, cw] of r3) {
    cell(page, cx3, yR3, cw, H_R3, lbl, val, fR, fR, { vSize: SZ_DATA });
    cx3 += cw;
  }
  cell(page, ML + LCW, yR3, RCW, H_R3,
    'Nosso número',
    nossoNumero(data.boletoId),
    fR, fB, { vSize: SZ_DATA, rightAlign: true, drawBorder: false });

  // =========================================================================
  // ROW 4 — Uso banco | Carteira | Espécie | Qtd | (x)Valor | (=)Valor doc
  // =========================================================================
  hline(page, ML, yR4, W, LINE_THIN, VERY_LIGHT);

  const r4: [string, string, number][] = [
    ['Uso do banco', '',    64],
    ['Carteira',     '06',  64],
    ['Espécie',      'R$',  50],
    ['Quantidade',   '',    78],
    ['(x) Valor',    '',   LCW - 64 - 64 - 50 - 78],
  ];
  let cx4 = ML;
  for (const [lbl, val, cw] of r4) {
    cell(page, cx4, yR4, cw, H_R4, lbl, val, fR, fR, { vSize: SZ_DATA });
    cx4 += cw;
  }

  // Valor do documento — DESTAQUE com fundo sutil
  page.drawRectangle({
    x: ML + LCW + 0.3, y: yR4 + 0.3,
    width: RCW - 0.6, height: H_R4 - 0.6,
    color: BG_SUBTLE,
  });
  cell(page, ML + LCW, yR4, RCW, H_R4,
    '(=) Valor documento',
    fmtBRL(data.valor),
    fR, fB, { vSize: SZ_DATA_LG, rightAlign: true, drawBorder: false });

  // =========================================================================
  // ROW 5 — Instruções (esquerda) | QR PIX (centro-dir) | Campos monetários (direita)
  // =========================================================================
  hline(page, ML, yR5, W, LINE_THIN, VERY_LIGHT);

  page.drawText(t('Instruções (Texto de responsabilidade do cedente)'), {
    x: ML + 3, y: yR5 + H_R5 - SZ_LABEL - 2.5,
    font: fR, size: SZ_LABEL, color: MEDIUM,
  });

  const refLine = t(`Referente: ${mesLabel(data.mesReferencia)} - ${desc}`);
  const instrLines = [
    { text: refLine, bold: true },
    { text: t('Não receber após o vencimento.'), bold: false },
    { text: t('Em caso de dúvidas, entre em contato com o escritório.'), bold: false },
  ];

  // --- QR dimensões e posição (centrado na metade direita da col. esquerda) ---
  const QR_SIZE    = 80;
  const qrCenterX  = ML + Math.round(LCW * 0.62);        // ~62% da coluna esquerda
  const qrX        = qrCenterX - QR_SIZE / 2;
  const qrBottomY  = yR5 + 26;                            // 26pt acima da base — próximo a "Valor cobrado"
  const qrTopY     = qrBottomY + QR_SIZE;

  // Largura máxima para instruções (não ultrapassar a borda esquerda do QR)
  const instrMaxW  = qrX - 10 - (ML + 12);

  // Instruções (lado esquerdo, truncadas para caber)
  let iy = yR5 + H_R5 - SZ_LABEL - 16;
  for (const line of instrLines) {
    let txt = line.text;
    const font = line.bold ? fB : fR;
    while (font.widthOfTextAtSize(txt, 8.5) > instrMaxW && txt.length > 1) {
      txt = txt.slice(0, -1);
    }

    page.drawCircle({
      x: ML + 6, y: iy + 3,
      size: 1.5,
      color: MEDIUM,
    });
    page.drawText(txt, {
      x: ML + 12, y: iy,
      font,
      size: 8.5,
      color: line.bold ? DARK : MEDIUM,
    });
    iy -= 14;
  }

  // --- QR Code PIX (simulado) ---
  const pixPayload = `pix-ficticio-banco-mvp-${data.boletoId}`;
  const qrPngBuffer = await QRCode.toBuffer(pixPayload, {
    type: 'png',
    width: 300,
    margin: 1,
    color: { dark: '#141414', light: '#FFFFFF' },
  });
  const qrImage = await pdfDoc.embedPng(qrPngBuffer);

  page.drawImage(qrImage, {
    x: qrX, y: qrBottomY,
    width: QR_SIZE, height: QR_SIZE,
  });

  // Textos PIX centralizados abaixo do QR
  const pixTitle = t('PIX | Pague com Banco MVP');
  const pixSub   = t('Ou use a linha digitável');
  const pxTitleW = fB.widthOfTextAtSize(pixTitle, 8);
  const pxSubW   = fR.widthOfTextAtSize(pixSub, 6.5);

  page.drawText(pixTitle, {
    x: qrCenterX - pxTitleW / 2,
    y: qrBottomY - 11,
    font: fB, size: 8, color: DARK,
  });
  page.drawText(pixSub, {
    x: qrCenterX - pxSubW / 2,
    y: qrBottomY - 21,
    font: fR, size: 6.5, color: MEDIUM,
  });

  // Campos monetários (coluna direita)
  const moFields: [string, string][] = [
    [t('(-) Desconto / Abatimentos'), ''],
    [t('(-) Outras deduções'),        ''],
    [t('(+) Mora / Multa'),           ''],
    [t('(+) Outros acréscimos'),      ''],
    [t('(=) Valor cobrado'),          ''],
  ];
  const moH = H_R5 / moFields.length;
  moFields.forEach(([lbl, val], i) => {
    cell(page, ML + LCW, yR5 + H_R5 - (i + 1) * moH, RCW, moH,
      lbl, val, fR, fR, { vSize: SZ_DATA, rightAlign: true });
  });

  // =========================================================================
  // ROW 6 — Sacado (dados do cliente) | Cód. baixa
  // =========================================================================
  hline(page, ML, yR6, W, LINE_THIN, VERY_LIGHT);

  const BAIXA_W = 88;

  page.drawText('Sacado', {
    x: ML + 3, y: yR6 + H_R6 - SZ_LABEL - 2.5,
    font: fR, size: SZ_LABEL, color: MEDIUM,
  });

  page.drawText(clienteNome, {
    x: ML + 4, y: yR6 + H_R6 - SZ_LABEL - 15,
    font: fB, size: 10, color: DARK,
  });
  page.drawText(`CNPJ: ${cnpj || '-'}`, {
    x: ML + 4 + fB.widthOfTextAtSize(clienteNome, 10) + 10,
    y: yR6 + H_R6 - SZ_LABEL - 15,
    font: fR, size: 9, color: MEDIUM,
  });

  page.drawText(t(`Referência: ${mesLabel(data.mesReferencia)}`), {
    x: ML + 4, y: yR6 + H_R6 - SZ_LABEL - 28,
    font: fR, size: 8, color: MEDIUM,
  });

  const endereco = t(`Rua do Comércio, Centro - ${cnpj ? cnpj.slice(-5) : '00000'}`);
  page.drawText(endereco, {
    x: ML + 4, y: yR6 + H_R6 - SZ_LABEL - 40,
    font: fR, size: 7.5, color: LIGHT,
  });

  vline(page, ML + W - BAIXA_W, yR6, yR6 + H_R6, LINE_THIN, VERY_LIGHT);
  page.drawText('Cód. baixa', {
    x: ML + W - BAIXA_W + 3,
    y: yR6 + H_R6 - SZ_LABEL - 2.5,
    font: fR, size: SZ_LABEL, color: MEDIUM,
  });

  // =========================================================================
  // FOOTER — Sacador/Avalista + Autenticação mecânica
  // =========================================================================
  hline(page, ML, yFoot, W, LINE_MEDIUM, MEDIUM);

  page.drawText('Sacador / Avalista', {
    x: ML + 3, y: yFoot + 4,
    font: fR, size: SZ_LABEL, color: MEDIUM,
  });

  const authStr = t('Autenticação mecânica - Ficha de Compensação');
  const authW   = fR.widthOfTextAtSize(authStr, SZ_LABEL);
  page.drawText(authStr, {
    x: ML + W - authW - 3, y: yFoot + 4,
    font: fR, size: SZ_LABEL, color: MEDIUM,
  });

  // =========================================================================
  // CÓDIGO DE BARRAS (nítido, alinhado à esquerda)
  // =========================================================================
  const barSeed  = data.boletoId.replace(/-/g, '');
  const N_BARS   = 103;
  const BAR_ZONE = W * 0.72;
  const barUnit  = BAR_ZONE / N_BARS;

  for (let i = 0; i < N_BARS; i++) {
    const ch     = barSeed.charCodeAt(i % barSeed.length) || 48;
    const isWide = i % 5 === 0;
    if (ch % 2 === 0) {
      page.drawRectangle({
        x: ML + i * barUnit, y: yBar,
        width: isWide ? barUnit * 2.4 : barUnit * 1.1,
        height: H_BAR,
        color: BLACK,
      });
    }
  }

  const cbText = codigoBarrasNum(data.boletoId);
  page.drawText(cbText, {
    x: ML, y: yBar - 11,
    font: fR, size: 7.5, color: DARK,
  });

  // =========================================================================
  // AVISO MVP (discreto, sutil)
  // =========================================================================
  const yAviso = yBar - 30;
  page.drawText(
    t('ATENÇÃO: Documento gerado automaticamente para fins de portfólio/MVP. Sem validade bancária.'),
    { x: ML, y: yAviso, font: fR, size: 5.5, color: LIGHT },
  );
  page.drawText(`Ref: ${data.boletoId}`, {
    x: ML, y: yAviso - 10,
    font: fR, size: 5, color: VERY_LIGHT,
  });

  // =========================================================================
  // Salvar
  // =========================================================================
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
