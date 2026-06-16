import type { MetadataRoute } from "next";
import { portfolioProjects, projectSlug } from "@/lib/knowledge";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bhanu-copilot.vercel.app";

// Bumped when site content changes; surfaced as <lastmod> for crawlers.
const lastModified = "2026-06-16";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified, changeFrequency: "monthly", priority: 1 },
    ...portfolioProjects.map((project) => ({
      url: `${siteUrl}/projects/${projectSlug(project.name)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
