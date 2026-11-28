import { describe, expect, it } from "vitest";
import { projects } from "./knowledge";
import { NOT_FOUND_SLUG, projectRoute } from "./project-route";

const slugs = ["atal-ai-2-0", "aura-ai", "hindi-semantic-search"];

describe("projectRoute", () => {
  it("passes a canonical slug through untouched", () => {
    expect(projectRoute("/projects/atal-ai-2-0", slugs)).toEqual({ action: "next" });
  });

  it("passes the App Router's transport forms of a canonical slug through", () => {
    expect(
      projectRoute("/projects/atal-ai-2-0.segments/_tree.segment.rsc", slugs),
    ).toEqual({ action: "next" });
  });

  it("leaves an unknown lowercase slug to the page (dynamicParams = false gives the 404)", () => {
    expect(projectRoute("/projects/nope", slugs)).toEqual({ action: "next" });
  });

  it("redirects a wrong-case slug to the lowercase one", () => {
    // Regression: on a case-insensitive disk (macOS, Windows) the prerender
    // cache served /projects/ATAL-AI-2-0 from atal-ai-2-0.html, then wrote a
    // 404 over the real page.
    expect(projectRoute("/projects/ATAL-AI-2-0", slugs)).toEqual({
      action: "redirect",
      pathname: "/projects/atal-ai-2-0",
    });
    expect(projectRoute("/projects/Aura-Ai", slugs)).toEqual({
      action: "redirect",
      pathname: "/projects/aura-ai",
    });
  });

  it("fixes a wrong-case section prefix too", () => {
    expect(projectRoute("/Projects/aura-ai", slugs)).toEqual({
      action: "redirect",
      pathname: "/projects/aura-ai",
    });
    expect(projectRoute("/PROJECTS/AURA-AI", slugs)).toEqual({
      action: "redirect",
      pathname: "/projects/aura-ai",
    });
  });

  it("accepts a trailing slash on redirect", () => {
    expect(projectRoute("/projects/AURA-AI/", slugs)).toEqual({
      action: "redirect",
      pathname: "/projects/aura-ai",
    });
  });

  it("is a 404 for a wrong-case slug with a transport suffix or a sub-path", () => {
    // The router only ever asks for the canonical slug; these are crafted.
    expect(
      projectRoute("/projects/AURA-AI.segments/_tree.segment", slugs),
    ).toEqual({ action: "not-found" });
    expect(projectRoute("/projects/AURA-AI/extra", slugs)).toEqual({
      action: "not-found",
    });
  });

  it("redirects a percent-encoded spelling of a real slug to the plain one", () => {
    expect(projectRoute("/projects/atal%2Dai-2-0", slugs)).toEqual({
      action: "redirect",
      pathname: "/projects/atal-ai-2-0",
    });
  });

  it("is a 404 for a wrong-case slug that is not a project", () => {
    expect(projectRoute("/projects/NOPE", slugs)).toEqual({ action: "not-found" });
  });

  it("is a 404 for non-ASCII look-alikes a case-folding disk could match", () => {
    // U+017F (long s) case-folds to "s" on APFS but not in toLowerCase().
    expect(projectRoute("/projects/hindi-%C5%BFemantic-search", slugs)).toEqual({
      action: "not-found",
    });
  });

  it("is a 404 for a malformed escape", () => {
    expect(projectRoute("/projects/%E0%A4", slugs)).toEqual({ action: "not-found" });
  });

  it("ignores paths outside /projects/<slug>", () => {
    expect(projectRoute("/", slugs)).toEqual({ action: "next" });
    expect(projectRoute("/projects", slugs)).toEqual({ action: "next" });
    expect(projectRoute("/projectsX/aura-ai", slugs)).toEqual({ action: "next" });
  });

  it("reserves a 404 slug that is never a project", () => {
    expect(slugs).not.toContain(NOT_FOUND_SLUG);
    expect(NOT_FOUND_SLUG).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("the real project slugs", () => {
  const real = projects.map((project) => project.slug);

  it("are all lowercase ASCII, so every one is served and redirected to", () => {
    for (const slug of real) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(projectRoute(`/projects/${slug}`, real)).toEqual({ action: "next" });
      expect(projectRoute(`/projects/${slug.toUpperCase()}`, real)).toEqual({
        action: "redirect",
        pathname: `/projects/${slug}`,
      });
    }
  });

  it("never include the reserved 404 slug", () => {
    expect(real).not.toContain(NOT_FOUND_SLUG);
  });
});
