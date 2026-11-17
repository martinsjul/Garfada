import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter", () => {
  it("permite até o limite e bloqueia o seguinte", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now });
    expect([1, 2, 3].map(() => limiter.check("ip").ok)).toEqual([true, true, true]);
    const blocked = limiter.check("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("libera de novo após a janela", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });
    limiter.check("ip");
    expect(limiter.check("ip").ok).toBe(false);
    clock.advance(60_001);
    expect(limiter.check("ip").ok).toBe(true);
  });

  it("chaves diferentes são independentes", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("b").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
  });
});
