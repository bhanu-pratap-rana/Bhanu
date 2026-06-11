import { describe, expect, it } from "vitest";
import { parseInline } from "./markdown";

describe("parseInline", () => {
  it("parses a link", () => {
    expect(parseInline("see [docs](https://x.com)")).toContainEqual({
      type: "link",
      value: "docs",
      href: "https://x.com",
    });
  });

  it("parses bold and code", () => {
    const segs = parseInline("use **FastAPI** and `uvicorn`");
    expect(segs).toContainEqual({ type: "bold", value: "FastAPI" });
    expect(segs).toContainEqual({ type: "code", value: "uvicorn" });
  });

  it("returns a single text segment for plain text", () => {
    expect(parseInline("just text")).toEqual([
      { type: "text", value: "just text" },
    ]);
  });
});
