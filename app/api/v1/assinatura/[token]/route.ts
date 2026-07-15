import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, PDFImage, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { prisma, emailService, storageService, redisPublisher } from '@/infrastructure/di/Container';
import { checkRateLimit, getClientIp } from '@/utils/rateLimiter';

type Params = { params: Promise<{ token: string }> };

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where: { tokenAssinatura: token },
    select: {
      id:             true,
      status:         true,
      expiresAt:      true,
      signatarioNome: true,
      provider:       true,
      linkExterno:    true,
      documento: { select: { fileName: true, fileType: true, storagePath: true } },
    },
  });

  if (!assinatura) return NextResponse.json({ message: 'Link inválido' }, { status: 404 });

  if (assinatura.status !== 'PENDENTE') {
    return NextResponse.json({ message: 'Este link já foi utilizado', status: assinatura.status }, { status: 410 });
  }

  if (new Date() > assinatura.expiresAt) {
    await prisma.assinaturaDocumento.update({
      where: { id: assinatura.id },
      data: { status: 'EXPIRADO' },
    });
    return NextResponse.json({ message: 'Link expirado' }, { status: 410 });
  }

  let pdfUrl: string | null = null;
  if (assinatura.documento.fileType === 'PDF') {
    const presigned = await storageService.gerarPresignedUrlDownload(
      assinatura.documento.storagePath,
      1800,
    );
    pdfUrl = presigned.url;
  }

  return NextResponse.json({
    nomeDocumento:  assinatura.documento.fileName,
    signatarioNome: assinatura.signatarioNome,
    expiresAt:      assinatura.expiresAt,
    provider:       assinatura.provider,
    linkExterno:    assinatura.linkExterno ?? null,
    pdfUrl,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`assinatura:${ip}`, 10, 60 * 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: 'Muitas tentativas. Tente novamente mais tarde.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSec) } },
    );
  }

  const { token } = await params;

  const body = await req.json().catch(() => ({})) as {
    confirmacao?:       boolean;
    nomeAssinante?:     string;
    motivoRecusa?:      string;
    signatureDataUrl?:  string;   // base64 PNG drawn by the user
    placement?: {                 // where to embed the signature image
      page:     number;           // 0-indexed (999 = last page)
      xPct:     number;           // 0-1 fraction from left
      yPct:     number;           // 0-1 fraction from top
      widthPct: number;           // 0-1 fraction of page width
    } | null;
  };
  const { confirmacao, nomeAssinante, motivoRecusa } = body;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where: { tokenAssinatura: token },
    include: {
      documento: { select: { fileName: true, fileType: true, storagePath: true, id: true } },
    },
  });

  if (!assinatura || assinatura.status !== 'PENDENTE' || new Date() > assinatura.expiresAt) {
    return NextResponse.json({ message: 'Link inválido ou expirado' }, { status: 410 });
  }

  const otpVerificado = await redisPublisher.getdel(`otp:verified:${assinatura.id}`);
  if (!otpVerificado) {
    return NextResponse.json({ message: 'Verificação de identidade necessária', code: 'OTP_REQUIRED' }, { status: 403 });
  }

  if (confirmacao && (!nomeAssinante || nomeAssinante.trim().length < 3)) {
    return NextResponse.json({ message: 'Informe seu nome completo para assinar.' }, { status: 400 });
  }

  const novoStatus = confirmacao ? 'ASSINADO' : 'RECUSADO';
  const agora      = new Date();

  // Reserva atômica: garante que apenas uma requisição processa esta assinatura
  const reserva = await prisma.assinaturaDocumento.updateMany({
    where: { id: assinatura.id, status: 'PENDENTE' },
    data:  { status: novoStatus },
  });
  if (reserva.count === 0) {
    return NextResponse.json({ message: 'Esta assinatura já foi processada.' }, { status: 409 });
  }

  let comprovanteStoragePath: string | undefined;

  if (confirmacao && assinatura.documento.fileType === 'PDF') {
    try {
      const pdfBuffer = await storageService.getBuffer(assinatura.documento.storagePath);
      const pdfDoc    = await PDFDocument.load(pdfBuffer);
      const font      = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pdfPages  = pdfDoc.getPages();

      const dataFormatada = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      // ── Decode drawn signature image ──────────────────────────────────────
      let sigImg: PDFImage | undefined;
      if (body.signatureDataUrl) {
        try {
          const base64 = body.signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
          sigImg = await pdfDoc.embedPng(Buffer.from(base64, 'base64'));
        } catch {
          // Non-fatal: fall back to text-only block
        }
      }
      const sigAspect = sigImg ? sigImg.width / sigImg.height : 700 / 220;

      // ── Determine layout ──────────────────────────────────────────────────
      let auditPage: PDFPage;

      if (!body.placement && sigImg) {
        // No placement chosen → add a dedicated signature page
        const newPage = pdfDoc.addPage([595, 842]);
        const { width: nW, height: nH } = newPage.getSize();

        const imgW = nW * 0.55;
        const imgH = imgW / sigAspect;

        // Center signature image in the upper portion
        newPage.drawImage(sigImg, {
          x:      (nW - imgW) / 2,
          y:      nH - 140 - imgH,
          width:  imgW,
          height: imgH,
        });
        // Signature underline
        newPage.drawLine({
          start:     { x: (nW - imgW) / 2,  y: nH - 148 - imgH },
          end:       { x: (nW + imgW) / 2,  y: nH - 148 - imgH },
          thickness: 0.5,
          color:     rgb(0.55, 0.55, 0.55),
        });

        auditPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
      } else {
        // Placement chosen (or no drawn image) → embed image in-page
        if (body.placement && sigImg) {
          const { page: pageIdx, xPct, yPct, widthPct } = body.placement;
          const pg = pdfPages[Math.max(0, Math.min(pageIdx, pdfPages.length - 1))];
          const { width: pgW, height: pgH } = pg.getSize();

          const imgW = Math.min(widthPct * pgW, pgW * 0.85);
          const imgH = imgW / sigAspect;

          // Convert from PDF.js top-left origin to pdf-lib bottom-left origin
          const pdfX = Math.max(0, Math.min(xPct * pgW - imgW / 2, pgW - imgW));
          const pdfY = Math.max(0, Math.min((1 - yPct) * pgH - imgH / 2, pgH - imgH));

          pg.drawImage(sigImg, { x: pdfX, y: pdfY, width: imgW, height: imgH });
        }

        auditPage = pdfPages[pdfPages.length - 1];
      }

      // ── Audit block (legal trail) ─────────────────────────────────────────
      const { width } = auditPage.getSize();
      const margin = 30;
      const blockH = 88;
      const blockY = margin;
      const innerX = margin + 10;
      const lineH  = 13;
      let curY     = blockY + blockH - 18;

      auditPage.drawRectangle({
        x:           margin,
        y:           blockY,
        width:       width - 2 * margin,
        height:      blockH,
        color:       rgb(0.96, 0.97, 1.0),
        borderColor: rgb(0.2, 0.35, 0.65),
        borderWidth: 0.8,
      });

      auditPage.drawText('Assinatura Eletrônica — FiscoHub', {
        x: innerX, y: curY, size: 8, font: fontBold, color: rgb(0.1, 0.25, 0.55),
      });
      curY -= lineH;

      auditPage.drawLine({
        start: { x: margin, y: curY + 4 },
        end:   { x: width - margin, y: curY + 4 },
        thickness: 0.4,
        color: rgb(0.6, 0.65, 0.75),
      });
      curY -= 4;

      auditPage.drawText(`Assinado por: ${nomeAssinante!.trim()}`, {
        x: innerX, y: curY, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1),
      });
      curY -= lineH;

      auditPage.drawText(`Data/hora: ${dataFormatada}`, {
        x: innerX, y: curY, size: 7.5, font, color: rgb(0.2, 0.2, 0.2),
      });
      curY -= lineH;

      auditPage.drawText(`IP: ${ip}`, {
        x: innerX, y: curY, size: 7.5, font, color: rgb(0.2, 0.2, 0.2),
      });
      curY -= lineH;

      auditPage.drawText(`Hash do documento original: ${assinatura.hashDocumento}`, {
        x: innerX, y: curY, size: 6, font, color: rgb(0.45, 0.45, 0.45),
      });

      const signedBytes = await pdfDoc.save();
      const signedPath  = `assinado/${assinatura.documento.id}/${token}.pdf`;
      await storageService.upload(signedPath, Buffer.from(signedBytes), 'application/pdf');
      comprovanteStoragePath = signedPath;
    } catch {
      // Failure to embed signature does not block the record
    }
  }

  // Atualiza campos complementares (status já foi reservado atomicamente acima)
  await prisma.assinaturaDocumento.update({
    where: { id: assinatura.id },
    data: confirmacao
      ? {
          assinadoAt:   agora,
          ipAssinatura: ip,
          ...(comprovanteStoragePath && { comprovanteStoragePath }),
        }
      : { motivoRecusa: motivoRecusa ?? 'Recusado pelo signatário' },
  });

  const solicitante = await prisma.usuarioContador.findUnique({
    where:  { id: assinatura.solicitanteId },
    select: { email: true, name: true },
  }).catch(() => null);

  if (solicitante) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    emailService.enviarStatusAssinatura({
      emailSolicitante: solicitante.email,
      nomeSolicitante:  solicitante.name,
      nomeDocumento:    assinatura.documento.fileName,
      nomeSignatario:   assinatura.signatarioNome,
      status:           novoStatus as 'ASSINADO' | 'RECUSADO',
      motivoRecusa:     confirmacao ? undefined : (motivoRecusa ?? 'Recusado pelo signatário'),
      urlPortal:        `${appUrl}/lote`,
    }).catch(() => {});
  }

  return NextResponse.json({
    message: confirmacao ? 'Documento assinado com sucesso' : 'Assinatura recusada',
  });
}
