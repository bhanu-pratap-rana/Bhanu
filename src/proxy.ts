import { NextResponse, type NextRequest } from "next/server";
import { projects } from "@/lib/knowledge";
import { NOT_FOUND_SLUG, projectRoute } from "@/lib/project-route";

const slugs = projects.map((project) => project.slug);

/**
 * Project slugs are lowercase. A wrong-case one (/projects/ATAL-AI-2-0) is a
 * permanent redirect to the real page, or a 404, before Next's prerender
 * cache can look it up on a case-insensitive disk: see lib/project-route.ts.
 */
export function proxy(request: NextRequest) {
  const route = projectRoute(request.nextUrl.pathname, slugs);
  if (route.action === "next") return NextResponse.next();
  const url = request.nextUrl.clone();
  if (route.action === "redirect") {
    url.pathname = route.pathname;
    return NextResponse.redirect(url, 308);
  }
  // The site's own 404 page, with a 404 status (dynamicParams = false).
  url.pathname = `/projects/${NOT_FOUND_SLUG}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Any casing of /projects/<...>, so /Projects/... is caught too. Next
  // compiles matchers case-sensitively, hence the character classes.
  matcher: "/:section([Pp][Rr][Oo][Jj][Ee][Cc][Tt][Ss])/:path+",
};
