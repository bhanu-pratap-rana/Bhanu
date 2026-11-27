// Single source for the public origin. The deployed site and the résumé both
// use bhanu-xi.vercel.app; NEXT_PUBLIC_SITE_URL overrides it for previews.
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bhanu-xi.vercel.app"
).replace(/\/$/, "");

export const siteName = "Bhanu Pratap Rana";

// Bumped when content changes. Feeds the sitemap <lastmod> and the footer, as
// one fixed ISO date so server and client never format it differently.
export const lastUpdatedIso = "2026-11-27";
export const lastUpdatedLabel = "27 November 2026";

export const sourceRepoUrl = "https://github.com/bhanu-pratap-rana/Bhanu";

// Next merges metadata shallowly, so a page that sets its own openGraph drops
// every field the layout set. Pages spread this to keep the shared ones.
export const baseOpenGraph = {
  type: "website",
  siteName,
  locale: "en_IN",
} as const;

// Unlisted projects have no row of their own on the home page; they appear
// only in the "Smaller public work" line, so that is where "back" lands.
export function workAnchorHref(project: {
  slug: string;
  listed: boolean;
}): string {
  return project.listed ? `/#work-${project.slug}` : "/#work-more";
}
