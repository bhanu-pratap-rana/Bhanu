// The Content-Security-Policy, built from what the site actually uses. Loaded
// by next.config.ts, so relative imports only.

import { EMBED_ORIGINS, type EmbedProvider } from "./project-media";

export { EMBED_ORIGINS };

export function buildCsp({
  dev,
  providers,
}: Readonly<{ dev: boolean; providers: readonly EmbedProvider[] }>): string {
  // React's dev runtime (Turbopack / Fast Refresh) needs eval() for debugging
  // features like callstack reconstruction. Production never uses eval.
  const scriptSrc = dev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const frames = [...new Set(providers.map((p) => EMBED_ORIGINS[p]))].sort();

  return [
    "default-src 'self'",
    // Next App Router hydration injects inline runtime scripts.
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // Self-hosted demo videos (public/projects/<slug>/).
    "media-src 'self'",
    // Only when a project embeds a walkthrough, and only that provider.
    ...(frames.length > 0 ? [`frame-src ${frames.join(" ")}`] : []),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
