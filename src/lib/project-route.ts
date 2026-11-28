// What the proxy (src/proxy.ts) does with a /projects/<slug> request, kept
// free of Next so it can be tested.
//
// Why it exists: project pages are prerendered to files named by slug. On a
// case-insensitive disk (macOS, Windows) Next's cache lookup for
// /projects/ATAL-AI-2-0 found atal-ai-2-0.html and served it as a duplicate,
// and a background regeneration then wrote a 404 over the real page. The
// proxy runs before that lookup, so only canonical slugs ever reach it.

/** A slug no project uses: a 404 is a rewrite to it (dynamicParams = false). */
export const NOT_FOUND_SLUG = "not-a-project";

export type ProjectRoute =
  | { action: "next" }
  | { action: "redirect"; pathname: string }
  | { action: "not-found" };

/** Prefix, slug (up to a dot or slash) and the rest (the App Router's transport suffixes). */
const PROJECT_PATH = /^\/(projects)\/([^/.]+)(.*)$/i;
const CANONICAL_SLUG = /^[a-z0-9-]+$/;

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function projectRoute(
  pathname: string,
  slugs: readonly string[],
): ProjectRoute {
  const match = PROJECT_PATH.exec(pathname);
  if (!match) return { action: "next" };
  const [, prefix, raw, rest] = match;

  // The hot path: a plain lowercase ASCII slug cannot collide with another
  // file, so the page decides (a real project, or the 404).
  if (prefix === "projects" && CANONICAL_SLUG.test(raw)) return { action: "next" };

  const decoded = decode(raw);
  if (decoded === null) return { action: "not-found" };
  const lower = decoded.toLowerCase();
  // Only the page itself is redirected. The router never asks for a
  // wrong-case transport form (.segments/...) or a sub-path, so those are
  // crafted, and a 404 is safer than guessing how Next normalized them.
  const isPage = rest === "" || rest === "/";
  if (isPage && CANONICAL_SLUG.test(lower) && slugs.includes(lower)) {
    return { action: "redirect", pathname: `/projects/${lower}` };
  }
  // Wrong case, an escape or a non-ASCII look-alike of nothing we serve:
  // never let it reach the case-folding file lookup.
  return { action: "not-found" };
}
