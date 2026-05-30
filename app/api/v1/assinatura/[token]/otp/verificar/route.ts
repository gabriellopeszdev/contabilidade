import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma, redisPublisher }      from '@/infrastructure/di/Container';
import { checkRateLimit }              from '@/utils/rateLimiter';

type Params = { params: Promise<{ token: string }> };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFIED_TTL_SEC = 600; // 10 min para completar a assinatura
const MAX_ATTEMPTS     = 5;
const SECRET           = () => process.env.JWT_SECRET ?? 'fiscohub-otp-secret';

function hashOtp(otp: string): string {
  return createHmac('sha256', SECRET()).update(otp).digest('hex');
}

// POST /api/v1/assinatura/:token/otp/verificar
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const body = await req.json().catch(() => ({})) as { otp?: string };
  const otp  = body.otp?.trim();

  if (!otp || !/^\d{6}$/.test(otp)) {
    return NextResponse.json({ message: 'Código inválido. Informe os 6 dígitos.' }, { status: 400 });
  }

  const assinatura = await prisma.assinaturaDocumento.findUnique({
    where:  { tokenAssinatura: token },
    select: { id: true, status: true, expiresAt: true },
  });

  if (!assinatura || assinatura.status !== 'PENDENTE' || new Date() > assinatura.expiresAt) {
    return NextResponse.json({ message: 'Link inválido ou expirado' }, { status: 410 });
  }

  // Rate limit por IP como defesa extra contra brute-force
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
  const rl = await checkRateLimit(`otp:verify:${ip}`, 20, 900);
  if (!rl.allowed) {
    return NextResponse.json({ message: 'Muitas tentativas. Aguarde antes de tentar novamente.' }, { status: 429 });
  }

  // Lê OTP do Redis
  const raw = await redisPublisher.get(`otp:sig:${assinatura.id}`);
  if (!raw) {
    return NextResponse.json({ message: 'Código expirado. Solicite um novo.' }, { status: 400 });
  }

  const stored = JSON.parse(raw) as { hash: string; attempts: number; ip: string };

  if (stored.attempts >= MAX_ATTEMPTS) {
    await redisPublisher.del(`otp:sig:${assinatura.id}`);
    return NextResponse.json({ message: 'Número máximo de tentativas atingido. Solicite um novo código.' }, { status: 400 });
  }

  // Incrementa tentativas antes de validar (evita race condition)
  stored.attempts += 1;
  const ttl = await redisPublisher.ttl(`otp:sig:${assinatura.id}`);
  await redisPublisher.set(`otp:sig:${assinatura.id}`, JSON.stringify(stored), 'EX', Math.max(ttl, 1));

  // Comparação segura contra timing attacks
  const expectedHash = Buffer.from(stored.hash);
  const receivedHash = Buffer.from(hashOtp(otp));
  const valido = expectedHash.length === receivedHash.length && timingSafeEqual(expectedHash, receivedHash);

  if (!valido) {
    const restantes = MAX_ATTEMPTS - stored.attempts;
    return NextResponse.json(
      { message: restantes > 0 ? `Código incorreto. ${restantes} tentativa(s) restante(s).` : 'Código incorreto. Solicite um novo.' },
      { status: 400 },
    );
  }

  // OTP válido: remove o OTP e cria flag "verificado" por 10 min
  await redisPublisher.del(`otp:sig:${assinatura.id}`);
  await redisPublisher.set(`otp:verified:${assinatura.id}`, '1', 'EX', VERIFIED_TTL_SEC);

  return NextResponse.json({ ok: true });
}
