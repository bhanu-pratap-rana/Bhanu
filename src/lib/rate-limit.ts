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
// Hard cap on tracked keys so a flood of spoofed identifiers cannot grow the
// map without bound (defense-in-depth alongside the expiry sweep below).
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Window>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

// Drop expired entries so the map stays bounded under churny / spoofed keys.
function sweep(now: number) {
  for (const [key, window] of buckets) {
    if (now >= window.resetAt) buckets.delete(key);
  }
  // Last-resort bound if everything is somehow still live.
  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= overflow) break;
    }
  }
}

export function rateLimit(key: string, now = Date.now()): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    sweep(now);
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
  // Prefer the edge-injected header (Vercel overwrites this with the real
  // client IP and it cannot be spoofed by the caller). Fall back to the
  // leftmost X-Forwarded-For only for local/dev where no trusted proxy exists.
  const trusted = request.headers.get("x-vercel-forwarded-for");
  if (trusted) return trusted.split(",")[0]?.trim() || "anonymous";

  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "anonymous";
}
