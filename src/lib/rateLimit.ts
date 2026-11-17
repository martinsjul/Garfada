interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/**
 * Limite por janela deslizante, guardado em memória.
 * Na Vercel cada instância tem a própria memória: é proteção de melhor esforço.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);

      if (recent.length >= limit) {
        hits.set(key, recent);
        const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000));
        return { ok: false, retryAfterSec };
      }

      recent.push(t);
      hits.set(key, recent);
      return { ok: true, retryAfterSec: 0 };
    },
  };
}

export const chatLimiter = createRateLimiter({ limit: 20, windowMs: 3_600_000 });
export const menuLimiter = createRateLimiter({ limit: 8, windowMs: 3_600_000 });
