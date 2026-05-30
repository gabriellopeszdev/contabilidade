import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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
      1800, // 30 minutos — suficiente para ler e assinar
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
    confirmacao?:   boolean;
    nomeAssinante?: string;
    motivoRecusa?:  string;
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

  // Exige que o OTP tenha sido verificado previamente
  const otpVerificado = await redisPublisher.get(`otp:verified:${assinatura.id}`);
  if (!otpVerificado) {
    return NextResponse.json({ message: 'Verificação de identidade necessária', code: 'OTP_REQUIRED' }, { status: 403 });
  }

  if (confirmacao && (!nomeAssinante || nomeAssinante.trim().length < 3)) {
    return NextResponse.json({ message: 'Informe seu nome completo para assinar.' }, { status: 400 });
  }

  const novoStatus = confirmacao ? 'ASSINADO' : 'RECUSADO';
  const agora      = new Date();

  let comprovanteStoragePath: string | undefined;

  // ---------------------------------------------------------------------------
  // Assinatura: embute bloco no PDF e salva comprovante no MinIO
  // ---------------------------------------------------------------------------
  if (confirmacao && assinatura.documento.fileType === 'PDF') {
    try {
      const pdfBuffer  = await storageService.getBuffer(assinatura.documento.storagePath);
      const pdfDoc     = await PDFDocument.load(pdfBuffer);
      const font       = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages      = pdfDoc.getPages();
      const lastPage   = pages[pages.length - 1];
      const { width }  = lastPage.getSize();

      const margin  = 30;
      const blockH  = 88;
      const blockY  = margin;
      const innerX  = margin + 10;
      const lineH   = 13;
      let   curY    = blockY + blockH - 18;

      const dataFormatada = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      // Fundo + borda do bloco de assinatura
      lastPage.drawRectangle({
        x:           margin,
        y:           blockY,
        width:       width - 2 * margin,
        height:      blockH,
        color:       rgb(0.96, 0.97, 1.0),
        borderColor: rgb(0.2, 0.35, 0.65),
        borderWidth: 0.8,
      });

      // Título
      lastPage.drawText('Assinatura Eletrônica — FiscoHub', {
        x: innerX, y: curY, size: 8, font: fontBold, color: rgb(0.1, 0.25, 0.55),
      });
      curY -= lineH;

      // Linha divisória
      lastPage.drawLine({
        start: { x: margin, y: curY + 4 },
        end:   { x: width - margin, y: curY + 4 },
        thickness: 0.4,
        color: rgb(0.6, 0.65, 0.75),
      });
      curY -= 4;

      lastPage.drawText(`Assinado por: ${nomeAssinante!.trim()}`, {
        x: innerX, y: curY, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1),
      });
      curY -= lineH;

      lastPage.drawText(`Data/hora: ${dataFormatada}`, {
        x: innerX, y: curY, size: 7.5, font, color: rgb(0.2, 0.2, 0.2),
      });
      curY -= lineH;

      lastPage.drawText(`IP: ${ip}`, {
        x: innerX, y: curY, size: 7.5, font, color: rgb(0.2, 0.2, 0.2),
      });
      curY -= lineH;

      lastPage.drawText(`Hash do documento original: ${assinatura.hashDocumento}`, {
        x: innerX, y: curY, size: 6, font, color: rgb(0.45, 0.45, 0.45),
      });

      const signedBytes = await pdfDoc.save();
      const signedPath  = `assinado/${assinatura.documento.id}/${token}.pdf`;

      await storageService.upload(signedPath, Buffer.from(signedBytes), 'application/pdf');
      comprovanteStoragePath = signedPath;
    } catch {
      // Falha ao embutir assinatura no PDF não deve bloquear o registro
    }
  }

  // Invalida a flag de OTP verificado (uso único)
  await redisPublisher.del(`otp:verified:${assinatura.id}`);

  await prisma.assinaturaDocumento.update({
    where: { id: assinatura.id },
    data: {
      status: novoStatus,
      ...(confirmacao
        ? {
            assinadoAt:             agora,
            ipAssinatura:           ip,
            ...(comprovanteStoragePath && { comprovanteStoragePath }),
          }
        : { motivoRecusa: motivoRecusa ?? 'Recusado pelo signatário' }),
    },
  });

  // Notifica o solicitante por e-mail (fire-and-forget)
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
