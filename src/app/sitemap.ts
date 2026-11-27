import type { MetadataRoute } from "next";
import { projects } from "@/lib/knowledge";
import { lastUpdatedIso, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: lastUpdatedIso,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...projects.map((project) => ({
      url: `${siteUrl}/projects/${project.slug}`,
      lastModified: lastUpdatedIso,
      changeFrequency: "monthly" as const,
      priority: project.listed ? 0.7 : 0.4,
    })),
  ];
}
