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

export function rateLimit(
  key: string,
  now = Date.now(),
  max = MAX_REQUESTS,
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    sweep(now);
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: max - existing.count,
    retryAfterSeconds: 0,
  };
}

export function clientKey(
  request: Request,
  options: { onVercel?: boolean } = {},
): string {
  const onVercel = options.onVercel ?? process.env.VERCEL === "1";
  const first = (value: string | null) =>
    value?.split(",")[0]?.trim() || undefined;
  const last = (value: string | null) =>
    value?.split(",").at(-1)?.trim() || undefined;

  // On Vercel the edge overwrites both headers with the real client IP.
  if (onVercel) {
    return (
      first(request.headers.get("x-vercel-forwarded-for")) ??
      first(request.headers.get("x-forwarded-for")) ??
      "anonymous"
    );
  }
  // Anywhere else these headers are caller-supplied. The rightmost hop is the
  // one the nearest proxy appended, so it is the only part worth trusting.
  return last(request.headers.get("x-forwarded-for")) ?? "anonymous";
}
