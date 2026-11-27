import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";

// next/font/google only works inside the Next compiler; the layout's metadata
// is what is under test, not its fonts.
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "font", className: "font", style: {} });
  return { Anek_Latin: font, Anek_Devanagari: font };
});

import { projects } from "@/lib/knowledge";
import { baseOpenGraph, siteName, workAnchorHref } from "@/lib/site";
import { metadata as layoutMetadata } from "./layout";
import { metadata as homeMetadata } from "./page";
import { generateMetadata as projectMetadata } from "./projects/[slug]/page";
import robots from "./robots";

async function metadataFor(slug: string): Promise<Metadata> {
  return projectMetadata({ params: Promise.resolve({ slug }) });
}

describe("shared Open Graph fields", () => {
  it("baseOpenGraph carries type, site name and locale", () => {
    expect(baseOpenGraph).toEqual({
      type: "website",
      siteName,
      locale: "en_IN",
    });
  });

  it("the root layout spreads baseOpenGraph into its openGraph", () => {
    expect(layoutMetadata.openGraph).toMatchObject(baseOpenGraph);
  });
});

describe("project page metadata", () => {
  const project = projects[0];

  it("keeps the shared Open Graph fields and the OG image", async () => {
    const meta = await metadataFor(project.slug);
    expect(meta.openGraph).toMatchObject({
      ...baseOpenGraph,
      title: project.name,
      description: project.summary,
      url: `/projects/${project.slug}`,
      images: ["/opengraph-image"],
    });
  });

  it("gives the Twitter card the project's own title and description", async () => {
    const meta = await metadataFor(project.slug);
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      title: project.name,
      description: project.summary,
      images: ["/opengraph-image"],
    });
  });
});

describe("canonical and robots", () => {
  it("the layout sets no canonical, so the 404 page inherits none", () => {
    expect(layoutMetadata.alternates?.canonical).toBeUndefined();
  });

  it("the layout leaves robots to the index/follow default", () => {
    expect(layoutMetadata.robots).toBeUndefined();
  });

  it("the home page declares its own canonical", () => {
    expect(homeMetadata.alternates?.canonical).toBe("/");
  });

  it("robots.txt disallows only the API, so ?q= links can show their canonical", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    expect(list).toHaveLength(1);
    expect(list[0].disallow).toEqual(["/api/"]);
  });
});

describe("workAnchorHref", () => {
  it("points a listed project to its own row", () => {
    expect(workAnchorHref({ slug: "abc", listed: true })).toBe("/#work-abc");
  });

  it("points an unlisted project to the smaller-work line, which has no per-project row", () => {
    expect(workAnchorHref({ slug: "abc", listed: false })).toBe("/#work-more");
  });

  it("every unlisted project falls back to #work-more", () => {
    for (const project of projects.filter((p) => !p.listed)) {
      expect(workAnchorHref(project)).toBe("/#work-more");
    }
  });
});
