import { describe, expect, it } from "vitest";
import { buildCsp, EMBED_ORIGINS } from "./csp";
import { projects } from "./knowledge";
import { embedProviders } from "./project-media";

const directives = (csp: string) =>
  Object.fromEntries(
    csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")];
    }),
  );

describe("buildCsp", () => {
  it("is strict without embeds: self-hosted media, no frame-src", () => {
    const d = directives(buildCsp({ dev: false, providers: [] }));
    expect(d["default-src"]).toBe("'self'");
    expect(d["script-src"]).toBe("'self' 'unsafe-inline'");
    expect(d["media-src"]).toBe("'self'");
    expect(d["img-src"]).toBe("'self' data:");
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d).not.toHaveProperty("frame-src");
  });

  it("allows eval only in development", () => {
    expect(directives(buildCsp({ dev: true, providers: [] }))["script-src"]).toBe(
      "'self' 'unsafe-inline' 'unsafe-eval'",
    );
  });

  it("allows only the embed origins in use, once each, in a stable order", () => {
    expect(directives(buildCsp({ dev: false, providers: ["youtube"] }))["frame-src"]).toBe(
      "https://www.youtube-nocookie.com",
    );
    expect(
      directives(buildCsp({ dev: false, providers: ["youtube", "loom", "youtube"] }))["frame-src"],
    ).toBe("https://www.loom.com https://www.youtube-nocookie.com");
  });

  it("never allows youtube.com itself (only the no-cookie host)", () => {
    expect(EMBED_ORIGINS.youtube).toBe("https://www.youtube-nocookie.com");
    expect(buildCsp({ dev: false, providers: ["youtube"] })).not.toMatch(/www\.youtube\.com/);
  });

  it("derives the site's policy from the projects", () => {
    const csp = buildCsp({ dev: false, providers: embedProviders(projects) });
    const hasEmbed = projects.some((p) => p.media?.some((m) => m.kind === "embed"));
    expect("frame-src" in directives(csp)).toBe(hasEmbed);
  });
});
