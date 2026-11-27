import { describe, expect, it } from "vitest";
import { clientKey, rateLimit } from "./rate-limit";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;

describe("rateLimit", () => {
  it("allows requests up to the limit within a window", () => {
    const key = "test-allow";
    const now = 1_000_000;
    for (let i = 0; i < MAX_REQUESTS; i += 1) {
      expect(rateLimit(key, now).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit and reports retry time", () => {
    const key = "test-block";
    const now = 2_000_000;
    for (let i = 0; i < MAX_REQUESTS; i += 1) {
      rateLimit(key, now);
    }
    const blocked = rateLimit(key, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = "test-reset";
    const now = 3_000_000;
    for (let i = 0; i < MAX_REQUESTS; i += 1) {
      rateLimit(key, now);
    }
    expect(rateLimit(key, now).allowed).toBe(false);
    expect(rateLimit(key, now + WINDOW_MS + 1).allowed).toBe(true);
  });

  it("decrements remaining as requests are consumed", () => {
    const key = "test-remaining";
    const now = 4_000_000;
    const first = rateLimit(key, now);
    const second = rateLimit(key, now);
    expect(first.remaining).toBe(MAX_REQUESTS - 1);
    expect(second.remaining).toBe(MAX_REQUESTS - 2);
  });
});

describe("rateLimit with a custom ceiling", () => {
  it("applies the given maximum instead of the default", () => {
    const key = "test-custom-max";
    const now = 5_000_000;
    expect(rateLimit(key, now, 2).allowed).toBe(true);
    expect(rateLimit(key, now, 2).allowed).toBe(true);
    expect(rateLimit(key, now, 2).allowed).toBe(false);
  });
});

describe("clientKey", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://site.example/api/chat", { headers });

  it("trusts Vercel's edge header only when running on Vercel", () => {
    const headers = {
      "x-vercel-forwarded-for": "9.9.9.9",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    };
    expect(clientKey(req(headers), { onVercel: true })).toBe("9.9.9.9");
    expect(clientKey(req(headers), { onVercel: false })).toBe("2.2.2.2");
  });

  it("off Vercel, uses the hop added by the nearest proxy, not the caller's claim", () => {
    expect(
      clientKey(req({ "x-forwarded-for": "spoofed, 3.3.3.3" }), { onVercel: false }),
    ).toBe("3.3.3.3");
    expect(clientKey(req({}), { onVercel: false })).toBe("anonymous");
  });
});
