// Single source for the public origin. The deployed site and the resume both
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

/** The home page's sections, in page order: the ids of the <section>s page.tsx renders. */
export const pageSectionIds = [
  "top",
  "work",
  "experience",
  "skills",
  "publications",
  "background",
  "how",
] as const;

/**
 * The footer's one contact line. It keeps the old Contact section's id, so
 * shared /#contact links and the copilot's contact note still land on the
 * email, and it sits outside <main> on every page.
 */
export const FOOTER_ID = "contact";

/** The saved resume's file name (header and footer): the PDF's URL slug is lower case for the web. */
export const RESUME_FILENAME = "Bhanu-Pratap-Rana-Resume.pdf";

/** The "Smaller public work" line under Work, where unlisted projects live. */
export const WORK_MORE_ID = "work-more";

/** The section nav: the header's from lg up, the hero's below lg (one array, so they agree). */
export const sectionLinks: readonly { href: `/#${(typeof pageSectionIds)[number]}`; label: string }[] = [
  { href: "/#work", label: "Work" },
  { href: "/#experience", label: "Experience" },
  { href: "/#skills", label: "Skills" },
  { href: "/#publications", label: "Publications" },
  { href: "/#background", label: "Background" },
];

// Unlisted projects have no row of their own on the home page; they appear
// only in the "Smaller public work" line, so that is where "back" lands.
export function workAnchorHref(project: {
  slug: string;
  listed: boolean;
}): string {
  return project.listed ? `/#work-${project.slug}` : `/#${WORK_MORE_ID}`;
}
