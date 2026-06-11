// Lightweight in-memory fixed-window rate limiter.
//
// NOTE: This protects a single server instance. On serverless platforms
// (Vercel) requests can hit different instances, so this is a best-effort
// guard, not a hard ceiling. For a production-grade shared limit, swap this
// for Upstash Redis (@upstash/ratelimit). It is intentionally dependency-free
// so the demo works out of the box.

type Window = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 15;

const buckets = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  now = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - existing.count,
    retryAfterSeconds: 0,
  };
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "anonymous";
  return ip;
}
