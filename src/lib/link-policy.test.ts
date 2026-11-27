import { describe, expect, it } from "vitest";
import { knowledgeBase, profile, projects } from "./knowledge";
import { isAllowedHref } from "./link-policy";

describe("isAllowedHref", () => {
  it("allows same-origin paths", () => {
    expect(isAllowedHref("/")).toBe(true);
    expect(isAllowedHref("/projects/atal-ai")).toBe(true);
    expect(isAllowedHref(profile.resumePath)).toBe(true);
    expect(isAllowedHref("/projects/atal-ai?ref=chat#stack")).toBe(true);
  });

  it("rejects protocol-relative and backslash paths", () => {
    expect(isAllowedHref("//evil.example/x")).toBe(false);
    expect(isAllowedHref("/\\evil.example/x")).toBe(false);
    expect(isAllowedHref("/ok\\evil")).toBe(false);
    expect(isAllowedHref("//github.com/bhanu-pratap-rana")).toBe(false);
  });

  it("allows in-page anchors", () => {
    expect(isAllowedHref("#work")).toBe(true);
    expect(isAllowedHref("#")).toBe(true);
  });

  it("allows only the one public mailto address, exactly", () => {
    expect(isAllowedHref(`mailto:${profile.email}`)).toBe(true);
    expect(isAllowedHref("mailto:ranabhanu514@gmail.com")).toBe(true);
    expect(isAllowedHref("mailto:someone.else@example.com")).toBe(false);
    expect(isAllowedHref("mailto:ranabhanu514@gmail.com?cc=x@example.com")).toBe(false);
    expect(isAllowedHref("mailto:ranabhanu514@gmail.com,x@example.com")).toBe(false);
    expect(isAllowedHref("MAILTO:ranabhanu514@gmail.com")).toBe(false);
  });

  it("allows https URLs under a listed href", () => {
    expect(isAllowedHref(profile.github)).toBe(true);
    expect(isAllowedHref(profile.linkedin)).toBe(true);
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana/anything")).toBe(true);
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana/ATAL-AI-2.0/blob/main/README.md")).toBe(true);
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana?tab=repositories")).toBe(true);
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana/voice-assistant#readme")).toBe(true);
    expect(isAllowedHref("https://www.linkedin.com/in/bhanu-pratap-rana")).toBe(true);
    expect(isAllowedHref("https://bhanu-pratap-rana.github.io/voice-assistant/")).toBe(true);
  });

  it("allows every link the knowledge base itself publishes", () => {
    const hrefs = [
      ...knowledgeBase.flatMap((item) => (item.links ?? []).map((link) => link.href)),
      ...projects.flatMap((project) => [project.repoUrl, project.demoUrl]),
    ].filter((href): href is string => typeof href === "string");
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of hrefs) {
      expect(isAllowedHref(href), href).toBe(true);
    }
  });

  it("rejects other accounts and other paths on an allowed host", () => {
    expect(isAllowedHref("https://github.com/torvalds/linux")).toBe(false);
    expect(isAllowedHref("https://github.com/")).toBe(false);
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana-evil/repo")).toBe(false);
    expect(isAllowedHref("https://www.linkedin.com/in/someone-else/")).toBe(false);
    expect(isAllowedHref("https://bhanu-pratap-rana.github.io/unlisted/")).toBe(false);
  });

  it("rejects path traversal out of an allowed prefix", () => {
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana/../torvalds/linux")).toBe(false);
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana/%2e%2e/torvalds")).toBe(false);
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana\\..\\torvalds")).toBe(false);
  });

  it("rejects other hosts, look-alike hosts, userinfo and ports", () => {
    expect(isAllowedHref("https://evil.example/")).toBe(false);
    expect(isAllowedHref("https://github.com.evil.example/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref("https://github.com@evil.example/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref("https://user:pw@github.com/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref("https://github.com:8443/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref("https://evil.example/?next=https://github.com/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref("https://evil.example/#https://github.com/bhanu-pratap-rana")).toBe(false);
  });

  it("rejects every scheme other than https", () => {
    expect(isAllowedHref("http://github.com/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedHref("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isAllowedHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isAllowedHref("vbscript:msgbox(1)")).toBe(false);
    expect(isAllowedHref("file:///etc/passwd")).toBe(false);
    expect(isAllowedHref("tel:+10000000000")).toBe(false);
    expect(isAllowedHref("https:github.com/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref("HTTPS://github.com/bhanu-pratap-rana")).toBe(false);
  });

  it("rejects empty, relative, and whitespace or control-character hrefs", () => {
    expect(isAllowedHref("")).toBe(false);
    expect(isAllowedHref("projects/atal-ai")).toBe(false);
    expect(isAllowedHref("github.com/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref(" https://github.com/bhanu-pratap-rana")).toBe(false);
    expect(isAllowedHref("java\tscript:alert(1)")).toBe(false);
    expect(isAllowedHref("/projects/a b")).toBe(false);
    expect(isAllowedHref("https://github.com/bhanu-pratap-rana\n")).toBe(false);
    expect(isAllowedHref("#a\u0000b")).toBe(false);
  });

  it("returns false instead of throwing on non-string input", () => {
    expect(isAllowedHref(undefined as unknown as string)).toBe(false);
  });
});
