import type { NextConfig } from "next";
import { buildCsp } from "./src/lib/csp";
import { projects } from "./src/lib/knowledge";
import { embedProviders } from "./src/lib/project-media";

const isDev = process.env.NODE_ENV !== "production";

// The CSP is built from what the projects use (src/lib/csp.ts, tested):
// media-src 'self' for demo videos, and frame-src only for the embed
// providers that some project's media actually uses. Relative imports: the
// config loader does not resolve the "@/" alias.
const contentSecurityPolicy = buildCsp({
  dev: isDev,
  providers: embedProviders(projects),
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
