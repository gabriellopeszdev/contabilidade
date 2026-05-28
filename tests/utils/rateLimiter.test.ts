import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
}));

vi.mock('@/infrastructure/di/Container', () => ({
  redisPublisher: mockRedis,
}));

// Import AFTER mock is set up
import { checkRateLimit, getClientIp } from '../../src/utils/rateLimiter';

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------
describe('checkRateLimit', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('normal operation', () => {
    it('allows first request (count=1) and sets remaining = max - 1', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(900);

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('calls expire only on the first request (count === 1)', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(900);

      await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(mockRedis.expire).toHaveBeenCalledOnce();
      expect(mockRedis.expire).toHaveBeenCalledWith('rl:login:1.2.3.4', 900);
    });

    it('does not call expire on subsequent requests (count > 1)', async () => {
      mockRedis.incr.mockResolvedValue(2);
      mockRedis.ttl.mockResolvedValue(850);

      await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('allows requests within the limit', async () => {
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.ttl.mockResolvedValue(600);

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });

    it('allows the request exactly at the limit (count === max, remaining = 0)', async () => {
      mockRedis.incr.mockResolvedValue(10);
      mockRedis.ttl.mockResolvedValue(300);

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('denies the request when count exceeds max', async () => {
      mockRedis.incr.mockResolvedValue(11);
      mockRedis.ttl.mockResolvedValue(250);

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('remaining never goes below 0 (count far exceeds max)', async () => {
      mockRedis.incr.mockResolvedValue(999);
      mockRedis.ttl.mockResolvedValue(100);

      const result = await checkRateLimit('test:key', 10, 900);

      expect(result.remaining).toBe(0);
    });

    it('returns TTL as resetInSec when TTL is positive', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(890);

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.resetInSec).toBe(890);
    });

    it('returns windowSec as resetInSec when TTL is -1 (key has no expiry)', async () => {
      mockRedis.incr.mockResolvedValue(2);
      mockRedis.ttl.mockResolvedValue(-1);

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.resetInSec).toBe(900);
    });

    it('returns windowSec as resetInSec when TTL is 0', async () => {
      mockRedis.incr.mockResolvedValue(2);
      mockRedis.ttl.mockResolvedValue(0);

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.resetInSec).toBe(900);
    });

    it('prefixes the redis key with "rl:"', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(60);

      await checkRateLimit('mykey', 5, 60);

      expect(mockRedis.incr).toHaveBeenCalledWith('rl:mykey');
    });
  });

  // ---------------------------------------------------------------------------
  // Fail-closed behavior
  // ---------------------------------------------------------------------------
  describe('fail-closed behavior when Redis is unavailable', () => {
    it('returns allowed=false when incr throws', async () => {
      mockRedis.incr.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.allowed).toBe(false);
    });

    it('returns remaining=0 when Redis throws', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis connection error'));

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.remaining).toBe(0);
    });

    it('returns windowSec as resetInSec when Redis throws', async () => {
      mockRedis.incr.mockRejectedValue(new Error('timeout'));

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.resetInSec).toBe(900);
    });

    it('does NOT silently allow requests when Redis is down', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Connection lost'));

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      // Must be denied — fail-closed means no pass-through
      expect(result.allowed).toBe(false);
    });

    it('returns allowed=false when ttl throws after a successful incr', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockRedis.ttl.mockRejectedValue(new Error('Redis error'));

      const result = await checkRateLimit('login:1.2.3.4', 10, 900);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetInSec).toBe(900);
    });
  });
});

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------
describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string | null>) {
    return {
      headers: {
        get: (h: string) => headers[h] ?? null,
      },
    };
  }

  it('returns the first IP from x-forwarded-for when multiple IPs are listed', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' });
    expect(getClientIp(req)).toBe('1.1.1.1');
  });

  it('returns the only IP when x-forwarded-for has a single entry', () => {
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.5' });
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('trims whitespace from the extracted IP', () => {
    const req = makeRequest({ 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' });
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-forwarded-for': null, 'x-real-ip': '5.5.5.5' });
    expect(getClientIp(req)).toBe('5.5.5.5');
  });

  it('returns "unknown" when both x-forwarded-for and x-real-ip are absent', () => {
    const req = makeRequest({ 'x-forwarded-for': null, 'x-real-ip': null });
    expect(getClientIp(req)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip when both headers are present', () => {
    const req = makeRequest({
      'x-forwarded-for': '7.7.7.7',
      'x-real-ip': '8.8.8.8',
    });
    expect(getClientIp(req)).toBe('7.7.7.7');
  });
});
