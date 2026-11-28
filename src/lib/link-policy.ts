import { knowledgeBase, profile, projects } from "./knowledge";

// Which hrefs in model output may become clickable links. The model can be
// steered by a pasted prompt, so a link is only rendered when it points at
// this site or at something the knowledge base itself links to. Everything
// else is shown as plain text by the renderer.

type AllowedPrefix = { origin: string; path: string };

const PUBLIC_MAILTO = `mailto:${profile.email}`;

// Spaces, control characters and backslashes are where browsers and URL
// parsers disagree ("/\host" is treated as "//host"), so they are never valid.
const UNSAFE_CHARS = /[\s\u0000-\u001f\u007f\\]/;

function toPrefix(href: string): AllowedPrefix | null {
  if (!href.startsWith("https://")) {
    return null;
  }
  try {
    const url = new URL(href);
    return { origin: url.origin, path: url.pathname.replace(/\/+$/, "") };
  } catch {
    return null;
  }
}

function collectPrefixes(): AllowedPrefix[] {
  const hrefs = [
    profile.github,
    profile.linkedin,
    ...knowledgeBase.flatMap((item) => (item.links ?? []).map((link) => link.href)),
    ...projects.flatMap((project) => [project.repoUrl, project.demoUrl]),
  ];
  const prefixes: AllowedPrefix[] = [];
  for (const href of hrefs) {
    const prefix = typeof href === "string" ? toPrefix(href) : null;
    if (prefix) {
      prefixes.push(prefix);
    }
  }
  return prefixes;
}

const ALLOWED_PREFIXES = collectPrefixes();

function isAllowedHttps(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    return false;
  }
  // Compare the parsed path, so "/user/../other" and "%2e%2e" are judged by
  // where they resolve, and match whole segments, so "/user-evil" is not
  // accepted for "/user".
  return ALLOWED_PREFIXES.some(
    (prefix) =>
      url.origin === prefix.origin &&
      (url.pathname === prefix.path || url.pathname.startsWith(`${prefix.path}/`)),
  );
}

export function isAllowedHref(href: string): boolean {
  if (typeof href !== "string" || href === "" || UNSAFE_CHARS.test(href)) {
    return false;
  }
  if (href.startsWith("#")) {
    return true;
  }
  if (href.startsWith("/")) {
    return !href.startsWith("//");
  }
  if (href === PUBLIC_MAILTO) {
    return true;
  }
  // Lower-case "https://" only: "https:host" resolves as a relative path on an
  // https page, and nothing the knowledge base links to needs another form.
  if (href.startsWith("https://")) {
    return isAllowedHttps(href);
  }
  return false;
}
