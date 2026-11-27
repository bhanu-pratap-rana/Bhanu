import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Shared question links (`/?q=…`) stay crawlable on purpose: a crawler has
    // to fetch them to see their canonical ("/"), or it indexes them as bare URLs.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
