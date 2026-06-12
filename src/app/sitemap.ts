import type { MetadataRoute } from "next";
import { portfolioProjects, projectSlug } from "@/lib/knowledge";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bhanu-copilot.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "monthly", priority: 1 },
    ...portfolioProjects.map((project) => ({
      url: `${siteUrl}/projects/${projectSlug(project.name)}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
