import { NextRequest, NextResponse } from 'next/server';
import { createHmac }               from 'crypto';
import { prisma, emailService, redisPublisher } from '@/infrastructure/di/Container';
import { checkRateLimit, getClientIp }          from '@/utils/rateLimiter';

type Params = { params: Promise<{ token: string }> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_TTL_SEC  = 900; // 15 minutos
const SECRET       = () => process.env.JWT_SECRET ?? 'fiscohub-otp-secret';

function gerarOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp: string): string {
  return createHmac('sha256', SECRET()).update(otp).digest('hex');
}

function mascararEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || local.length < 3) return email;
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(local.length - 2, 4))}@${domain}`;
}

// POST /api/v1/assinatura/:token/otp — gera e envia OTP
export async function POST(req: NextRequest, { params }: Params) {
  const ip        = getClientIp(req);
  const { token } = await params;

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where:  { tokenAssinatura: token },
    select: { id: true, status: true, expiresAt: true, signatarioEmail: true, signatarioNome: true, documento: { select: { fileName: true } } },
  });

  if (!assinatura || assinatura.status !== 'PENDENTE' || new Date() > assinatura.expiresAt) {
    return NextResponse.json({ message: 'Link inválido ou expirado' }, { status: 410 });
  }

  // Rate limit: máx. 3 envios por assinatura a cada 30 min
  const rl = await checkRateLimit(`otp:send:${assinatura.id}`, 3, 1800);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: `Muitos códigos enviados. Aguarde ${Math.ceil(rl.resetInSec / 60)} min.` },
      { status: 429 },
    );
  }

  const otp  = gerarOtp();
  const hash = hashOtp(otp);

  // Armazena hash + tentativas no Redis (sobrescreve se já existia)
  await redisPublisher.set(
    `otp:sig:${assinatura.id}`,
    JSON.stringify({ hash, attempts: 0, ip }),
    'EX', OTP_TTL_SEC,
  );

  await emailService.enviarOtpAssinatura({
    emailCliente:  assinatura.signatarioEmail,
    nomeCliente:   assinatura.signatarioNome,
    nomeDocumento: assinatura.documento.fileName,
    codigo:        otp,
  });

  return NextResponse.json({ maskedEmail: mascararEmail(assinatura.signatarioEmail) });
}
