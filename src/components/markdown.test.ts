import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MessageBody,
  countCitations,
  parseBlocks,
  parseInline,
  stripCitations,
} from "./markdown";

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

  it("returns no segments for an empty string", () => {
    expect(parseInline("")).toEqual([]);
  });
});

describe("parseInline citations", () => {
  it("parses a single citation", () => {
    expect(parseInline("Built it [1].")).toEqual([
      { type: "text", value: "Built it " },
      { type: "cite", numbers: [1] },
      { type: "text", value: "." },
    ]);
  });

  it("parses grouped citations with and without spaces", () => {
    expect(parseInline("a [1, 2] b")).toContainEqual({ type: "cite", numbers: [1, 2] });
    expect(parseInline("a [1,2,3] b")).toContainEqual({ type: "cite", numbers: [1, 2, 3] });
    expect(parseInline("a [ 2 , 4 ] b")).toContainEqual({ type: "cite", numbers: [2, 4] });
    expect(parseInline("a [1-3] b")).toContainEqual({ type: "cite", numbers: [1, 2, 3] });
    expect(parseInline("a [1, 3–4] b")).toContainEqual({ type: "cite", numbers: [1, 3, 4] });
  });

  it("emits one cite segment per adjacent bracket", () => {
    expect(parseInline("x [1][2]")).toEqual([
      { type: "text", value: "x " },
      { type: "cite", numbers: [1] },
      { type: "cite", numbers: [2] },
    ]);
  });

  it("defaults maxCite to 9", () => {
    expect(parseInline("[9]")).toEqual([{ type: "cite", numbers: [9] }]);
    expect(parseInline("[10]")).toEqual([{ type: "text", value: "[10]" }]);
  });

  it("keeps out-of-range brackets as plain text", () => {
    expect(parseInline("see [7]", { maxCite: 6 })).toEqual([
      { type: "text", value: "see [7]" },
    ]);
    expect(parseInline("see [0]", { maxCite: 6 })).toEqual([
      { type: "text", value: "see [0]" },
    ]);
    expect(parseInline("see [1, 7]", { maxCite: 6 })).toEqual([
      { type: "text", value: "see [1, 7]" },
    ]);
    expect(parseInline("see [1]", { maxCite: 0 })).toEqual([
      { type: "text", value: "see [1]" },
    ]);
  });

  it("keeps non-numeric brackets as plain text", () => {
    for (const text of ["[a]", "[1-]", "[1.5]", "[]", "[ ]", "[1,]", "[TODO]", "[-1]"]) {
      expect(parseInline(text), text).toEqual([{ type: "text", value: text }]);
    }
  });

  it("keeps a markdown link a link, even with a numeric label", () => {
    expect(parseInline("[1](https://x.com)")).toEqual([
      { type: "link", value: "1", href: "https://x.com" },
    ]);
    expect(parseInline("[text](/projects/a) [2]")).toEqual([
      { type: "link", value: "text", href: "/projects/a" },
      { type: "text", value: " " },
      { type: "cite", numbers: [2] },
    ]);
  });

  it("does not treat brackets inside inline code as citations", () => {
    expect(parseInline("`arr[1]` and `[2]`")).toEqual([
      { type: "code", value: "arr[1]" },
      { type: "text", value: " and " },
      { type: "code", value: "[2]" },
    ]);
  });

  it("lifts citations out of bold and italic runs", () => {
    expect(parseInline("**Aura AI [1]** shipped")).toEqual([
      { type: "bold", value: "Aura AI " },
      { type: "cite", numbers: [1] },
      { type: "text", value: " shipped" },
    ]);
    expect(parseInline("*piloted [2] widely*")).toEqual([
      { type: "italic", value: "piloted " },
      { type: "cite", numbers: [2] },
      { type: "italic", value: " widely" },
    ]);
  });

  it("leaves a trailing unclosed bracket as plain text while streaming", () => {
    expect(parseInline("Built it [")).toEqual([{ type: "text", value: "Built it [" }]);
    expect(parseInline("Built it [1")).toEqual([{ type: "text", value: "Built it [1" }]);
    expect(parseInline("Built it [1, 2")).toEqual([
      { type: "text", value: "Built it [1, 2" },
    ]);
    expect(parseInline("Built it [1][2")).toEqual([
      { type: "text", value: "Built it " },
      { type: "cite", numbers: [1] },
      { type: "text", value: "[2" },
    ]);
  });
});

describe("parseInline unclosed markers", () => {
  it("renders an unclosed ** as plain text", () => {
    expect(parseInline("this is **bold in prog")).toEqual([
      { type: "text", value: "this is **bold in prog" },
    ]);
    expect(parseInline("ends with **")).toEqual([
      { type: "text", value: "ends with **" },
    ]);
  });

  it("renders an unclosed backtick as plain text", () => {
    expect(parseInline("run `npm inst")).toEqual([
      { type: "text", value: "run `npm inst" },
    ]);
  });

  it("renders an unclosed link as plain text", () => {
    expect(parseInline("see [docs](https://x.c")).toEqual([
      { type: "text", value: "see [docs](https://x.c" },
    ]);
  });

  it("still formats the closed run before an unclosed marker", () => {
    expect(parseInline("**done** and **pend")).toEqual([
      { type: "bold", value: "done" },
      { type: "text", value: " and **pend" },
    ]);
  });

  it("does not make bold out of empty or blank content", () => {
    expect(parseInline("****")).toEqual([{ type: "text", value: "****" }]);
    expect(parseInline("** **")).toEqual([{ type: "text", value: "** **" }]);
  });
});

describe("parseInline italics", () => {
  it("parses *text* and _text_", () => {
    expect(parseInline("an *important* point")).toEqual([
      { type: "text", value: "an " },
      { type: "italic", value: "important" },
      { type: "text", value: " point" },
    ]);
    expect(parseInline("an _important_ point")).toContainEqual({
      type: "italic",
      value: "important",
    });
    expect(parseInline("(*two words*).")).toContainEqual({
      type: "italic",
      value: "two words",
    });
  });

  it("does not italicise identifiers with underscores", () => {
    for (const text of ["snake_case_name", "a_b", "__init__", "_private_var", "file_name.py and other_file.py"]) {
      expect(parseInline(text), text).toEqual([{ type: "text", value: text }]);
    }
  });

  it("does not italicise arithmetic or stray asterisks", () => {
    for (const text of ["2 * 3 * 4", "2*3*4", "a * b", "5 stars*", "*unclosed", "_unclosed", "* *"]) {
      expect(parseInline(text), text).toEqual([{ type: "text", value: text }]);
    }
  });

  it("keeps bold distinct from italic", () => {
    expect(parseInline("**bold** then *it*")).toEqual([
      { type: "bold", value: "bold" },
      { type: "text", value: " then " },
      { type: "italic", value: "it" },
    ]);
    expect(parseInline("***both***")).toEqual([{ type: "bold", value: "both" }]);
  });

  it("handles Devanagari word boundaries", () => {
    expect(parseInline("यह *महत्वपूर्ण* है")).toContainEqual({
      type: "italic",
      value: "महत्वपूर्ण",
    });
    expect(parseInline("हिंदी_शब्द_यहाँ")).toEqual([
      { type: "text", value: "हिंदी_शब्द_यहाँ" },
    ]);
  });
});

describe("countCitations", () => {
  it("returns distinct in-range numbers in order of first appearance", () => {
    expect(countCitations("a [3] b [1, 3] c [2][1]", 6)).toEqual({
      cited: [3, 1, 2],
      outOfRange: 0,
    });
  });

  it("counts bracketed numbers that point at no source", () => {
    expect(countCitations("a [1] b [7] c [0]", 6)).toEqual({ cited: [1], outOfRange: 2 });
    expect(countCitations("a [8, 9]", 6)).toEqual({ cited: [], outOfRange: 2 });
  });

  it("does not credit in-range numbers inside a bracket that is not rendered", () => {
    expect(countCitations("a [1, 7]", 6)).toEqual({ cited: [], outOfRange: 1 });
  });

  it("ignores links, inline code, fenced code and non-numeric brackets", () => {
    const text = "[1](https://x.com) `x[2]` [note] [1-]\n```\narr[3] = [4]\n```\nend [5]";
    expect(countCitations(text, 6)).toEqual({ cited: [5], outOfRange: 0 });
  });

  it("counts a range as its numbers", () => {
    expect(countCitations("a [2-4] b", 6)).toEqual({ cited: [2, 3, 4], outOfRange: 0 });
    expect(countCitations("a [6–7] b", 0)).toEqual({ cited: [], outOfRange: 2 });
  });

  it("counts across lists, headings and paragraphs", () => {
    const text = "## Work [1]\n\n- item [2]\n- item [9]\n\n1. step [3]";
    expect(countCitations(text, 6)).toEqual({ cited: [1, 2, 3], outOfRange: 1 });
  });

  it("returns nothing for text without citations", () => {
    expect(countCitations("plain", 6)).toEqual({ cited: [], outOfRange: 0 });
    expect(countCitations("", 6)).toEqual({ cited: [], outOfRange: 0 });
  });
});

describe("stripCitations", () => {
  it("removes every citation form and the space before it", () => {
    expect(stripCitations("Built X [1]. Then Y [2, 3] and Z [4][5].")).toBe(
      "Built X. Then Y and Z.",
    );
  });

  it("removes citations regardless of range", () => {
    expect(stripCitations("old answer [12]")).toBe("old answer");
  });

  it("leaves no leading space when a line starts with a citation", () => {
    expect(stripCitations("[1] Built X\n- [2] item")).toBe("Built X\n- item");
  });

  it("keeps links, code and non-numeric brackets", () => {
    const text = "[1](https://x.com) `arr[0]` [note]\n```\na[1] = [2]\n```";
    expect(stripCitations(text)).toBe(text);
  });

  it("removes citation ranges too", () => {
    expect(stripCitations("a [1-3] b [2, 4–5]")).toBe("a b");
  });

  it("keeps newlines and plain text intact", () => {
    expect(stripCitations("line one [1]\n\nline two")).toBe("line one\n\nline two");
    expect(stripCitations("nothing here")).toBe("nothing here");
  });
});

describe("parseBlocks", () => {
  it("separates paragraphs on blank lines and keeps single newlines as lines", () => {
    expect(parseBlocks("one\ntwo\n\nthree")).toEqual([
      { type: "paragraph", lines: ["one", "two"] },
      { type: "paragraph", lines: ["three"] },
    ]);
  });

  it("returns no blocks for empty or blank content", () => {
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("\n\n  \n")).toEqual([]);
  });

  it("groups consecutive bullets into one list", () => {
    expect(parseBlocks("intro\n- a\n* b\n- c\nafter")).toEqual([
      { type: "paragraph", lines: ["intro"] },
      { type: "ul", items: ["a", "b", "c"] },
      { type: "paragraph", lines: ["after"] },
    ]);
  });

  it("groups consecutive numbered lines into one list with its own start", () => {
    expect(parseBlocks("1. a\n2. b\n3. c")).toEqual([
      { type: "ol", start: 1, items: ["a", "b", "c"] },
    ]);
    expect(parseBlocks("3. c\n4. d")).toEqual([
      { type: "ol", start: 3, items: ["c", "d"] },
    ]);
  });

  it("keeps a list together across single blank lines between items", () => {
    expect(parseBlocks("1. a\n\n2. b\n\n3. c")).toEqual([
      { type: "ol", start: 1, items: ["a", "b", "c"] },
    ]);
    expect(parseBlocks("- a\n\n- b\n\ntext")).toEqual([
      { type: "ul", items: ["a", "b"] },
      { type: "paragraph", lines: ["text"] },
    ]);
  });

  it("starts a new list when the list type changes", () => {
    expect(parseBlocks("1. a\n- x\n- y\n2. b")).toEqual([
      { type: "ol", start: 1, items: ["a"] },
      { type: "ul", items: ["x", "y"] },
      { type: "ol", start: 2, items: ["b"] },
    ]);
  });

  it("does not treat bold at line start or arithmetic as a bullet", () => {
    expect(parseBlocks("**Bold** start")).toEqual([
      { type: "paragraph", lines: ["**Bold** start"] },
    ]);
    expect(parseBlocks("-5 degrees")).toEqual([
      { type: "paragraph", lines: ["-5 degrees"] },
    ]);
  });

  it("parses headings with their level", () => {
    expect(parseBlocks("# One\n#### Four\n##### Five")).toEqual([
      { type: "heading", level: 1, text: "One" },
      { type: "heading", level: 4, text: "Four" },
      { type: "paragraph", lines: ["##### Five"] },
    ]);
  });

  it("treats literal <br> as a newline", () => {
    expect(parseBlocks("a<br>b<br/>c<BR />d")).toEqual([
      { type: "paragraph", lines: ["a", "b", "c", "d"] },
    ]);
    expect(parseBlocks("- a<br>more")).toEqual([
      { type: "ul", items: ["a"] },
      { type: "paragraph", lines: ["more"] },
    ]);
  });

  it("keeps <br> literal inside inline code", () => {
    expect(parseBlocks("use `<br>` sparingly")).toEqual([
      { type: "paragraph", lines: ["use `<br>` sparingly"] },
    ]);
  });

  it("degrades a table to plain lines", () => {
    const table = "| Role | Year |\n|---|:--:|\n| Engineer | 2025 |\n| Founder<br>CTO | 2024 |";
    expect(parseBlocks(table)).toEqual([
      {
        type: "paragraph",
        lines: ["Role — Year", "Engineer — 2025", "Founder CTO — 2024"],
      },
    ]);
  });

  it("drops empty table cells and separator-only rows", () => {
    expect(parseBlocks("| a |  | c |\n| --- | --- | --- |")).toEqual([
      { type: "paragraph", lines: ["a — c"] },
    ]);
  });

  it("parses fenced code and leaves its content untouched", () => {
    const text = "before\n```ts\nconst a = [1];\n  - not a list<br>\n\n# not a heading\n```\nafter";
    expect(parseBlocks(text)).toEqual([
      { type: "paragraph", lines: ["before"] },
      {
        type: "code",
        lang: "ts",
        text: "const a = [1];\n  - not a list<br>\n\n# not a heading",
        closed: true,
      },
      { type: "paragraph", lines: ["after"] },
    ]);
  });

  it("renders an unclosed fence as code with what has arrived", () => {
    expect(parseBlocks("```python\nprint(1)\nprint(")).toEqual([
      { type: "code", lang: "python", text: "print(1)\nprint(", closed: false },
    ]);
    expect(parseBlocks("```")).toEqual([
      { type: "code", lang: "", text: "", closed: false },
    ]);
  });

  it("drops horizontal rules", () => {
    expect(parseBlocks("a\n\n---\n\nb")).toEqual([
      { type: "paragraph", lines: ["a"] },
      { type: "paragraph", lines: ["b"] },
    ]);
  });

  it("normalises CRLF line endings", () => {
    expect(parseBlocks("a\r\nb\r\n\r\n- c")).toEqual([
      { type: "paragraph", lines: ["a", "b"] },
      { type: "ul", items: ["c"] },
    ]);
  });

  it("leaves user content untouched", () => {
    const pasted = "# Job description\n- Python\n  indented   spacing\n\n**must** have [1] <br>";
    expect(parseBlocks(pasted, "user")).toEqual([{ type: "plain", text: pasted }]);
  });
});

describe("MessageBody", () => {
  const render = (
    content: string,
    extra: Partial<Parameters<typeof MessageBody>[0]> = {},
  ) =>
    renderToStaticMarkup(
      createElement(MessageBody, { content, role: "assistant", ...extra }),
    );

  it("renders real lists", () => {
    const html = render("- a\n- b\n\n3. c\n4. d");
    expect(html.match(/<ul/g)).toHaveLength(1);
    expect(html.match(/<ol/g)).toHaveLength(1);
    expect(html.match(/<li/g)).toHaveLength(4);
    expect(html).toContain('start="3"');
  });

  it("renders headings as paragraphs, never h-tags", () => {
    const html = render("## Title");
    expect(html).not.toMatch(/<h[1-6]/);
    expect(html).toMatch(/<p class="[^"]*font-semibold[^"]*">Title<\/p>/);
  });

  it("renders single newlines as <br/>", () => {
    expect(render("a\nb")).toContain("a<br/>b");
  });

  it("escapes HTML in model output", () => {
    const html = render('<img src=x onerror="alert(1)"> <script>x</script>');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
  });

  it("renders allowed external links in a new tab", () => {
    const html = render("[code](https://github.com/bhanu-pratap-rana/voice-assistant)");
    expect(html).toContain('href="https://github.com/bhanu-pratap-rana/voice-assistant"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
  });

  it("renders internal paths, anchors and the public mailto without a target", () => {
    for (const href of ["/projects/atal-ai", "#work", "mailto:ranabhanu514@gmail.com"]) {
      const html = render(`[go](${href})`);
      expect(html, href).toContain(`href="${href}"`);
      expect(html, href).not.toContain("target=");
    }
  });

  it("renders disallowed links as their label only", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,x",
      "http://github.com/bhanu-pratap-rana",
      "https://evil.example/",
      "https://github.com/someone-else",
      "mailto:other@example.com",
      "//evil.example",
    ]) {
      const html = render(`before [Email Bhanu](${href}) after`);
      expect(html, href).not.toContain("<a");
      expect(html, href).not.toContain("href");
      expect(html, href).toContain("before Email Bhanu after");
    }
  });

  it("renders the default citation marker", () => {
    const html = render("claim [1, 2]", { sourceCount: 3 });
    expect(html.match(/<sup class="cite[ "]/g)).toHaveLength(2);
    expect(html).toMatch(/<sup[^>]*>1<\/sup>/);
    expect(html).toMatch(/<sup[^>]*>2<\/sup>/);
  });

  it("uses sourceCount as the citation range", () => {
    expect(render("claim [4]", { sourceCount: 3 })).toContain("claim [4]");
    expect(render("claim [1]", { sourceCount: 0 })).toContain("claim [1]");
  });

  it("calls renderCite for each cited number", () => {
    const seen: number[] = [];
    const html = render("a [2][1] **b [3]**", {
      sourceCount: 3,
      renderCite: (n, key) => {
        seen.push(n);
        return createElement("button", { key, type: "button" }, `src ${n}`);
      },
    });
    expect(seen).toEqual([2, 1, 3]);
    expect(html).toContain("<button type=\"button\">src 2</button>");
    expect(html).not.toContain("<sup");
  });

  it("renders fenced code as pre/code without interpreting it", () => {
    const html = render("```\n**x** [1] <b>\n```", { sourceCount: 3 });
    expect(html).toMatch(/<pre[^>]*><code>\*\*x\*\* \[1\] &lt;b&gt;<\/code><\/pre>/);
    expect(html).toContain("overflow-x-auto");
  });

  it("renders user content as typed, with no markdown", () => {
    const html = render("**JD**\n- Python  3\n[x](https://github.com/bhanu-pratap-rana) [1]", {
      role: "user",
    });
    expect(html).toContain("**JD**\n- Python  3\n[x](https://github.com/bhanu-pratap-rana) [1]");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).not.toMatch(/<(ul|li|a|strong|sup|br)/);
  });

  it("never uses palette or case-transform utilities", () => {
    const html = render(
      "# h\n\ntext **b** *i* `c` [l](#x) [1]\n\n- a\n\n1. b\n\n```\ncode\n```",
      { sourceCount: 2 },
    );
    expect(html).not.toMatch(/stone-|gray-|-(?:white|black)\b|uppercase|tracking-/);
  });
});

describe("hostile input", () => {
  it("strips citations from a huge whitespace run in linear time", () => {
    const started = performance.now();
    expect(stripCitations(`${" ".repeat(60_000)}x [1]`).endsWith("x")).toBe(true);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("turns narrow and no-break spaces from the model into plain spaces", () => {
    const blocks = parseBlocks("ATAL AI 2.0 with 570 + students, 50 – 65 %");
    expect(JSON.stringify(blocks)).not.toMatch(/[    ]/);
    expect(JSON.stringify(blocks)).toContain("ATAL AI 2.0");
    expect(JSON.stringify(blocks)).toContain("570+ students");
    expect(JSON.stringify(blocks)).toContain("50–65%");
  });
});
