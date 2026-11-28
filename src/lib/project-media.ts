// Project media (screenshots, demo videos, embedded walkthroughs) and the
// links row. Pure helpers: the components and the CSP builder read these, and
// project-media.test.ts pins the rules down with a fixture project. Every
// field is optional on a project, so a project without media renders exactly
// as before.
//
// Only relative imports here (and type-only ones from knowledge.ts): this file
// is loaded by next.config.ts through csp.ts.

import type { KnowledgeItem, KnowledgeLink, Project } from "./knowledge";

export type EmbedProvider = "youtube" | "loom";

export type ProjectMedia =
  | {
      kind: "image";
      /** Local path under /projects/<slug>/. */
      src: string;
      alt: string;
      width: number;
      height: number;
      caption?: string;
    }
  | {
      /** Self-hosted mp4/webm: plays muted, inline, only after a click. */
      kind: "video";
      src: string;
      poster: string;
      alt: string;
      width: number;
      height: number;
      caption?: string;
    }
  | {
      /** A click-to-load facade: the iframe loads only after the click. */
      kind: "embed";
      provider: EmbedProvider;
      id: string;
      title: string;
      /** Local poster under /projects/<slug>/ (no third-party request before the click). */
      poster: string;
      width: number;
      height: number;
      caption?: string;
    };

/** Frame origins per provider. YouTube only through its no-cookie host. */
export const EMBED_ORIGINS: Record<EmbedProvider, string> = {
  youtube: "https://www.youtube-nocookie.com",
  loom: "https://www.loom.com",
};

export const PROVIDER_NAME: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  loom: "Loom",
};

/** The iframe URL, loaded only after the visitor pressed play (so it may autoplay). */
export function embedSrc(media: Extract<ProjectMedia, { kind: "embed" }>): string {
  const id = encodeURIComponent(media.id);
  return media.provider === "youtube"
    ? `${EMBED_ORIGINS.youtube}/embed/${id}?autoplay=1&rel=0`
    : `${EMBED_ORIGINS.loom}/embed/${id}?autoplay=1`;
}

/** The still that stands for an item: the image itself, or the poster. */
export function mediaThumbSrc(media: ProjectMedia): string {
  return media.kind === "image" ? media.src : media.poster;
}

/** Accessible description of an item. */
export function mediaLabel(media: ProjectMedia): string {
  return media.kind === "embed" ? media.title : media.alt;
}

/** A featured project's 16:10 cover on the home page: its first item. */
export function coverMedia(project: Project): ProjectMedia | undefined {
  return project.featured ? project.media?.[0] : undefined;
}

/** A listed, non-featured project's 64px thumbnail: its first item. */
export function thumbMedia(project: Project): ProjectMedia | undefined {
  return project.featured ? undefined : project.media?.[0];
}

/** Embed providers used anywhere, sorted and once each (drives the CSP). */
export function embedProviders(projects: readonly Project[]): EmbedProvider[] {
  const used = new Set<EmbedProvider>();
  for (const project of projects) {
    for (const media of project.media ?? []) {
      if (media.kind === "embed") used.add(media.provider);
    }
  }
  return [...used].sort();
}

/* ------------------------------------------------------------------ */
/* Links row: Live app -> Demo/Interface preview -> Code -> Details     */
/* (the Ask button follows, rendered by the component)                  */
/* ------------------------------------------------------------------ */

export type ProjectLinkKind = "live" | "demo" | "code" | "details";

export type ProjectLinkItem = {
  kind: ProjectLinkKind;
  label: string;
  href: string;
  /** Opens in a new tab (off-site). */
  external: boolean;
  /** "<label>: <project>", so a list of rows stays distinguishable. */
  ariaLabel: string;
};

export function projectLinks(
  project: Project,
  { details = true, codeLabel = "Code" }: { details?: boolean; codeLabel?: string } = {},
): ProjectLinkItem[] {
  const out: ProjectLinkItem[] = [];
  const add = (kind: ProjectLinkKind, label: string, href: string, external = true) =>
    out.push({ kind, label, href, external, ariaLabel: `${label}: ${project.name}` });

  if (project.liveUrl) add("live", project.liveLabel ?? "Live app", project.liveUrl);
  if (project.demoUrl) add("demo", project.demoLabel ?? "Demo", project.demoUrl);
  if (project.repoUrl) add("code", codeLabel, project.repoUrl);
  if (details) add("details", "Details", `/projects/${project.slug}`, false);
  return out;
}

/* ------------------------------------------------------------------ */
/* Copilot notes: the live app is the first link of the project's note  */
/* ------------------------------------------------------------------ */

export function withLiveLinks(
  notes: readonly KnowledgeItem[],
  projects: readonly Project[],
): KnowledgeItem[] {
  const live = new Map<string, KnowledgeLink>();
  for (const project of projects) {
    if (project.liveUrl) {
      live.set(project.kbId, { label: project.liveLabel ?? "Live app", href: project.liveUrl });
    }
  }
  return notes.map((note) => {
    const link = live.get(note.id);
    if (!link) return note;
    const rest = (note.links ?? []).filter((l) => l.href !== link.href);
    return { ...note, links: [link, ...rest] };
  });
}

/* ------------------------------------------------------------------ */
/* Validation (run over every project in project-media.test.ts)         */
/* ------------------------------------------------------------------ */

const EMBED_ID = /^[A-Za-z0-9_-]+$/;

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Every rule a project's media and links must meet. `exists(path)` answers
 * whether a site path such as /projects/x/cover.webp is a file in public/.
 * Returns readable errors; empty when the project is valid.
 */
export function validateProject(project: Project, exists: (path: string) => boolean): string[] {
  const errors: string[] = [];
  const where = (i: number) => `${project.slug}: media[${i}]`;
  const dir = `/projects/${project.slug}/`;

  if (project.liveUrl !== undefined && !isHttps(project.liveUrl)) {
    errors.push(`${project.slug}: liveUrl must be https (${project.liveUrl})`);
  }
  if (project.demoUrl !== undefined && !isHttps(project.demoUrl)) {
    errors.push(`${project.slug}: demoUrl must be https (${project.demoUrl})`);
  }

  const checkFile = (i: number, field: string, path: string) => {
    if (!path.trim()) {
      errors.push(`${where(i)}: ${field} is required`);
    } else if (!path.startsWith(dir) || path.includes("..")) {
      errors.push(`${where(i)}: ${field} must be a file in public${dir} (${path})`);
    } else if (!exists(path)) {
      errors.push(`${where(i)}: ${field} file not found: public${path}`);
    }
  };

  (project.media ?? []).forEach((media, i) => {
    if (!(media.width > 0)) errors.push(`${where(i)}: width must be positive`);
    if (!(media.height > 0)) errors.push(`${where(i)}: height must be positive`);
    if (media.kind === "embed") {
      if (!media.title.trim()) errors.push(`${where(i)}: title is required`);
      if (!EMBED_ID.test(media.id)) errors.push(`${where(i)}: id must match ${EMBED_ID}`);
      checkFile(i, "poster", media.poster);
    } else {
      if (!media.alt.trim()) errors.push(`${where(i)}: alt is required`);
      checkFile(i, "src", media.src);
      if (media.kind === "video") checkFile(i, "poster", media.poster);
    }
  });
  return errors;
}
