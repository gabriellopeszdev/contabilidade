import { redisPublisher } from '@/infrastructure/di/Container';

export interface RateLimitResult {
  allowed:    boolean;
  remaining:  number;
  resetInSec: number;
}

/**
 * Rate limiter usando Redis INCR + EXPIRE.
 *
 * @param key     Chave única (ex: `login:1.2.3.4`)
 * @param max     Número máximo de tentativas na janela
 * @param windowSec Duração da janela em segundos
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;

  try {
    const count = await redisPublisher.incr(redisKey);

    // Na primeira chamada, define o TTL da janela
    if (count === 1) {
      await redisPublisher.expire(redisKey, windowSec);
    }

    const ttl = await redisPublisher.ttl(redisKey);
    const remaining = Math.max(0, max - count);

    return {
      allowed:    count <= max,
      remaining,
      resetInSec: ttl > 0 ? ttl : windowSec,
    };
  } catch {
    // Se o Redis estiver fora, libera a requisição (fail-open)
    return { allowed: true, remaining: max, resetInSec: windowSec };
  }
}

export function getClientIp(request: { headers: { get: (h: string) => string | null } }): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
