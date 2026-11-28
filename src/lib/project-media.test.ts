import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { knowledgeBase, projects, type KnowledgeItem, type Project } from "./knowledge";
import {
  coverMedia,
  embedProviders,
  embedSrc,
  mediaThumbSrc,
  projectLinks,
  thumbMedia,
  validateProject,
  withLiveLinks,
} from "./project-media";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));
const existsInPublic = (path: string) => existsSync(`${publicDir}${path}`);

// One fake project with every kind of media, so the rendering rules are
// pinned down before any real project has a demo.
const fixture: Project = {
  slug: "demo-fixture",
  kbId: "demo-fixture",
  name: "Demo Fixture",
  attribution: "Test only",
  summary: "A project with every kind of media.",
  stack: ["Test"],
  featured: true,
  repoUrl: "https://github.com/example/demo",
  demoUrl: "https://example.github.io/demo/",
  demoLabel: "Interface preview",
  liveUrl: "https://demo.example.com/",
  media: [
    {
      kind: "image",
      src: "/projects/demo-fixture/cover.webp",
      alt: "The search screen with three results",
      width: 1600,
      height: 1000,
      caption: "Search",
    },
    {
      kind: "video",
      src: "/projects/demo-fixture/demo.mp4",
      poster: "/projects/demo-fixture/demo-poster.webp",
      alt: "Asking a question and getting a cited answer",
      width: 1600,
      height: 1000,
    },
    {
      kind: "embed",
      provider: "youtube",
      id: "dQw4w9WgXcQ",
      title: "Two-minute walkthrough",
      poster: "/projects/demo-fixture/yt-poster.webp",
      width: 1600,
      height: 900,
    },
    {
      kind: "embed",
      provider: "loom",
      id: "a1b2c3d4e5f6",
      title: "Teacher dashboard tour",
      poster: "/projects/demo-fixture/loom-poster.webp",
      width: 1600,
      height: 1000,
    },
  ],
  listed: true,
};

const fixtureFiles = new Set([
  "/projects/demo-fixture/cover.webp",
  "/projects/demo-fixture/demo.mp4",
  "/projects/demo-fixture/demo-poster.webp",
  "/projects/demo-fixture/yt-poster.webp",
  "/projects/demo-fixture/loom-poster.webp",
]);
const fixtureExists = (path: string) => fixtureFiles.has(path);

const bare: Project = {
  slug: "bare",
  kbId: "bare",
  name: "Bare",
  attribution: "Test only",
  summary: "No links, no media.",
  stack: [],
  listed: true,
};

describe("projectLinks", () => {
  it("orders Live app, demo, code, details", () => {
    expect(projectLinks(fixture).map((link) => link.kind)).toEqual([
      "live",
      "demo",
      "code",
      "details",
    ]);
  });

  it("labels each link and names the project in its accessible name", () => {
    const [live, demo, code, details] = projectLinks(fixture);
    expect(live).toMatchObject({ label: "Live app", href: "https://demo.example.com/", external: true });
    expect(live.ariaLabel).toBe("Live app: Demo Fixture");
    expect(demo).toMatchObject({ label: "Interface preview", external: true });
    expect(code).toMatchObject({ label: "Code", href: "https://github.com/example/demo" });
    expect(details).toMatchObject({ label: "Details", href: "/projects/demo-fixture", external: false });
  });

  it("uses liveLabel and drops details on the project's own page", () => {
    const links = projectLinks({ ...fixture, liveLabel: "Open the app" }, { details: false });
    expect(links.map((link) => link.label)).toEqual(["Open the app", "Interface preview", "Code"]);
  });

  it("lets the project page name the code link differently", () => {
    const links = projectLinks(fixture, { details: false, codeLabel: "Code on GitHub" });
    expect(links.find((link) => link.kind === "code")?.label).toBe("Code on GitHub");
  });

  it("keeps only details for a project without links", () => {
    expect(projectLinks(bare).map((link) => link.kind)).toEqual(["details"]);
    expect(projectLinks(bare, { details: false })).toEqual([]);
  });
});

describe("media selection", () => {
  it("covers a featured project with its first item", () => {
    expect(coverMedia(fixture)).toBe(fixture.media?.[0]);
    expect(thumbMedia(fixture)).toBeUndefined();
  });

  it("gives a non-featured project only a thumbnail", () => {
    const row = { ...fixture, featured: false };
    expect(coverMedia(row)).toBeUndefined();
    expect(thumbMedia(row)).toBe(fixture.media?.[0]);
  });

  it("changes nothing for a project without media", () => {
    expect(coverMedia(bare)).toBeUndefined();
    expect(thumbMedia(bare)).toBeUndefined();
    expect(coverMedia({ ...bare, featured: true, media: [] })).toBeUndefined();
  });

  it("thumbnails an image by itself and a video or embed by its poster", () => {
    const [image, video, youtube] = fixture.media ?? [];
    expect(mediaThumbSrc(image)).toBe("/projects/demo-fixture/cover.webp");
    expect(mediaThumbSrc(video)).toBe("/projects/demo-fixture/demo-poster.webp");
    expect(mediaThumbSrc(youtube)).toBe("/projects/demo-fixture/yt-poster.webp");
  });

  it("builds privacy-friendly embed URLs that play once loaded", () => {
    const youtube = fixture.media?.[2];
    const loom = fixture.media?.[3];
    if (youtube?.kind !== "embed" || loom?.kind !== "embed") throw new Error("fixture");
    expect(embedSrc(youtube)).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0",
    );
    expect(embedSrc(loom)).toBe("https://www.loom.com/embed/a1b2c3d4e5f6?autoplay=1");
  });

  it("lists the embed providers in use, once each", () => {
    expect(embedProviders([fixture, fixture, bare])).toEqual(["loom", "youtube"]);
    expect(embedProviders([bare])).toEqual([]);
  });
});

describe("validateProject", () => {
  it("accepts the fixture", () => {
    expect(validateProject(fixture, fixtureExists)).toEqual([]);
  });

  it("reports every broken rule", () => {
    const broken: Project = {
      ...fixture,
      liveUrl: "http://demo.example.com/",
      demoUrl: "javascript:alert(1)",
      media: [
        { kind: "image", src: "/projects/other/cover.webp", alt: " ", width: 0, height: 1000 },
        { kind: "video", src: "/projects/demo-fixture/missing.mp4", poster: "", alt: "Clip", width: 10, height: 10 },
        { kind: "embed", provider: "youtube", id: "bad id!", title: "", poster: "/projects/demo-fixture/yt-poster.webp", width: 16, height: -9 },
      ],
    };
    const errors = validateProject(broken, fixtureExists).join("\n");
    expect(errors).toMatch(/liveUrl must be https/);
    expect(errors).toMatch(/demoUrl must be https/);
    expect(errors).toMatch(/media\[0\].*alt/);
    expect(errors).toMatch(/media\[0\].*width/);
    expect(errors).toMatch(/media\[0\].*public\/projects\/demo-fixture\//);
    expect(errors).toMatch(/media\[1\].*poster/);
    expect(errors).toMatch(/media\[1\].*missing\.mp4/);
    expect(errors).toMatch(/media\[2\].*title/);
    expect(errors).toMatch(/media\[2\].*id/);
    expect(errors).toMatch(/media\[2\].*height/);
  });

  it("passes for every real project (files under public/projects/<slug>/)", () => {
    for (const project of projects) {
      expect(validateProject(project, existsInPublic), project.slug).toEqual([]);
    }
  });
});

describe("withLiveLinks", () => {
  const note: KnowledgeItem = {
    id: "demo-fixture",
    kind: "project",
    title: "Demo Fixture",
    summary: "",
    tags: [],
    body: "",
    links: [{ label: "Code", href: "https://github.com/example/demo" }],
    anchor: "work-demo-fixture",
    prompt: "",
    basis: "repo",
  };

  it("puts the live app first in the project's note links", () => {
    const [out] = withLiveLinks([note], [fixture]);
    expect(out.links).toEqual([
      { label: "Live app", href: "https://demo.example.com/" },
      { label: "Code", href: "https://github.com/example/demo" },
    ]);
    expect(note.links).toHaveLength(1);
  });

  it("is idempotent and leaves notes without a live project untouched", () => {
    const once = withLiveLinks([note], [fixture]);
    expect(withLiveLinks(once, [fixture])).toEqual(once);
    const [same] = withLiveLinks([note], [bare]);
    expect(same).toBe(note);
  });

  it("adds links to a note that had none", () => {
    const [out] = withLiveLinks([{ ...note, links: undefined }], [{ ...fixture, liveLabel: "App" }]);
    expect(out.links).toEqual([{ label: "App", href: "https://demo.example.com/" }]);
  });

  it("matches the knowledge base: every live project's note links to it", () => {
    for (const project of projects.filter((p) => p.liveUrl)) {
      const item = knowledgeBase.find((entry) => entry.id === project.kbId);
      expect(item?.links?.[0]?.href).toBe(project.liveUrl);
    }
  });
});
