import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Shared question links (`/?q=…`) are the same page; keep them out of the index.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/*?q="] },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
