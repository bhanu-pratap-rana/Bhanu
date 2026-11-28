import { describe, expect, it } from "vitest";
import { getProjectBySlug, getProjectDetail, projects } from "@/lib/knowledge";
import { showsBuiltWith, showsTopNote } from "./project-view";

describe("project page: say each thing once", () => {
  it("keeps the top note when it qualifies a preview or live link shown beside it", () => {
    const voice = getProjectBySlug("voice-ai-assistant")!;
    expect(showsTopNote(voice, true)).toBe(true);
    expect(showsTopNote({ note: "Beta.", liveUrl: "https://example.com" }, true)).toBe(true);
  });

  it("drops the top note when the detail note below already says it", () => {
    const aura = getProjectBySlug("aura-ai")!;
    expect(showsTopNote(aura, Boolean(getProjectDetail(aura)))).toBe(false);
  });

  it("keeps the top note as the fallback when there is no detail note", () => {
    expect(showsTopNote({ note: "Private repository." }, false)).toBe(true);
  });

  it("shows nothing when there is no note", () => {
    expect(showsTopNote({ demoUrl: "https://example.com" }, false)).toBe(false);
  });

  it("lists 'Built with' only when no pipeline already names the tools", () => {
    expect(showsBuiltWith({ pipeline: [{ node: "A", detail: "b" }] })).toBe(false);
    expect(showsBuiltWith({})).toBe(true);
    for (const project of projects) {
      expect(showsBuiltWith(project), project.slug).toBe(!project.pipeline);
    }
  });
});
