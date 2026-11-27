import { Fragment, type ReactNode } from "react";
import { isAllowedHref } from "../lib/link-policy";

// Lightweight markdown renderer for chat answers. Handles the subset the model
// actually emits: **bold**, *italic*, `code`, [links](url), [n] citations,
// headings, lists, fenced code, and tables degraded to plain lines. No external
// dependency, no hooks and no "use client", so it works from Server and Client
// Components. Model output is only ever rendered as React text nodes.

export type InlineSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string }
  | { type: "cite"; numbers: number[] };

export type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "heading"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; start: number; items: string[] }
  | { type: "code"; lang: string; text: string; closed: boolean }
  | { type: "plain"; text: string };

export type MessageRole = "user" | "assistant";

export type CiteRenderer = (n: number, key: string) => ReactNode;

export type MessageBodyProps = {
  content: string;
  role: MessageRole;
  /** Sources returned for this turn: [n] is a citation only for 1..sourceCount. */
  sourceCount?: number;
  /** Renders one citation number. Defaults to a plain <sup class="cite">. */
  renderCite?: CiteRenderer;
};

const DEFAULT_MAX_CITE = 9;

/* ------------------------------------------------------------------ */
/* Inline                                                               */
/* ------------------------------------------------------------------ */

// Letters, digits, combining marks and "_" count as word characters. Marks are
// included so a Devanagari matra next to "_" or "*" is treated like a letter.
const WORD_CHAR = /[\p{L}\p{N}\p{M}_]/u;
const SPACE = /\s/;

// One level of nested parentheses is allowed inside the URL.
const LINK_AT = /\[([^\]\n]+)\]\(((?:[^()\n]|\([^()\n]*\))*)\)/y;
const CITE_AT = /\[\s*\d+(?:\s*,\s*\d+)*\s*\]/y;

type InlineScan = { segments: InlineSegment[]; outOfRange: number };

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char);
}

function isSpace(char: string | undefined): boolean {
  return char !== undefined && SPACE.test(char);
}

function runLength(text: string, start: number, char: string): number {
  let end = start;
  while (text[end] === char) {
    end += 1;
  }
  return end - start;
}

// Index of the "*" that closes an italic run opened at `open`, or -1.
function findItalicStarClose(text: string, open: number): number {
  if (isWordChar(text[open - 1]) || text[open + 1] === undefined || isSpace(text[open + 1])) {
    return -1;
  }
  for (let j = open + 2; j < text.length; j += 1) {
    if (text[j] !== "*") {
      continue;
    }
    if (text[j + 1] === "*" || text[j - 1] === "*") {
      return -1;
    }
    if (!isSpace(text[j - 1]) && !isWordChar(text[j + 1])) {
      return j;
    }
  }
  return -1;
}

// Index of the "_" that closes an italic run opened at `open`, or -1. Both
// ends must sit on a word boundary, so snake_case and __dunder__ stay text.
function findItalicUnderscoreClose(text: string, open: number): number {
  const next = text[open + 1];
  if (isWordChar(text[open - 1]) || next === undefined || next === "_" || isSpace(next)) {
    return -1;
  }
  for (let j = open + 2; j < text.length; j += 1) {
    if (text[j] === "_" && !isSpace(text[j - 1]) && !isWordChar(text[j + 1])) {
      return j;
    }
  }
  return -1;
}

function scanInline(text: string, maxCite: number): InlineScan {
  const segments: InlineSegment[] = [];
  let outOfRange = 0;
  let plain = "";
  let i = 0;

  const flush = () => {
    if (plain !== "") {
      segments.push({ type: "text", value: plain });
      plain = "";
    }
  };

  // Bold and italic keep a flat { type, value } shape, so anything richer
  // inside them (a citation, code) is lifted out as its own segment.
  const pushStyled = (type: "bold" | "italic", inner: string) => {
    flush();
    const nested = scanInline(inner, maxCite);
    outOfRange += nested.outOfRange;
    for (const segment of nested.segments) {
      segments.push(segment.type === "text" ? { type, value: segment.value } : segment);
    }
  };

  while (i < text.length) {
    const char = text[i];

    if (char === "`") {
      const ticks = runLength(text, i, "`");
      const close = text.indexOf("`".repeat(ticks), i + ticks);
      const inner = close === -1 ? "" : text.slice(i + ticks, close);
      if (inner.trim() !== "") {
        flush();
        segments.push({ type: "code", value: ticks > 1 ? inner.trim() : inner });
        i = close + ticks;
      } else {
        // Unclosed while streaming: keep the backticks as text.
        plain += text.slice(i, i + ticks);
        i += ticks;
      }
      continue;
    }

    if (char === "[") {
      LINK_AT.lastIndex = i;
      const link = LINK_AT.exec(text);
      const href = link ? (link[2].trim().split(/\s+/)[0] ?? "") : "";
      if (link && href !== "") {
        flush();
        segments.push({ type: "link", value: link[1], href });
        i += link[0].length;
        continue;
      }
      CITE_AT.lastIndex = i;
      const cite = CITE_AT.exec(text);
      if (cite) {
        const numbers = (cite[0].match(/\d+/g) ?? []).map(Number);
        const missing = numbers.filter((n) => n < 1 || n > maxCite).length;
        if (missing === 0) {
          flush();
          segments.push({ type: "cite", numbers });
        } else {
          // A bracket with any number that points at no source stays text.
          outOfRange += missing;
          plain += cite[0];
        }
        i += cite[0].length;
        continue;
      }
      // Anything else, including a bracket that has not closed yet, is text.
    }

    if (char === "*") {
      const stars = runLength(text, i, "*");
      if (stars >= 2) {
        const width = stars >= 3 ? 3 : 2;
        const close = text.indexOf("*".repeat(width), i + width);
        const inner = close === -1 ? "" : text.slice(i + width, close);
        if (inner.trim() !== "") {
          pushStyled("bold", inner);
          i = close + width;
        } else {
          // Unclosed while streaming: keep the whole run as text so it is not
          // re-read as italic.
          plain += text.slice(i, i + stars);
          i += stars;
        }
        continue;
      }
      const close = findItalicStarClose(text, i);
      if (close !== -1) {
        pushStyled("italic", text.slice(i + 1, close));
        i = close + 1;
        continue;
      }
    }

    if (char === "_") {
      const close = findItalicUnderscoreClose(text, i);
      if (close !== -1) {
        pushStyled("italic", text.slice(i + 1, close));
        i = close + 1;
        continue;
      }
    }

    plain += char;
    i += 1;
  }

  flush();
  return { segments, outOfRange };
}

function toMaxCite(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_MAX_CITE;
  }
  return Math.max(0, Math.floor(value));
}

export function parseInline(text: string, opts?: { maxCite?: number }): InlineSegment[] {
  return scanInline(text, toMaxCite(opts?.maxCite)).segments;
}

/* ------------------------------------------------------------------ */
/* Blocks                                                               */
/* ------------------------------------------------------------------ */

const FENCE_OPEN = /^\s*```([\w+#.-]*)\s*$/;
const FENCE_CLOSE = /^\s*```\s*$/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const HEADING = /^(#{1,4})\s+(.+)$/;
const BULLET = /^[-*•]\s+(.+)$/;
const NUMBERED = /^(\d{1,3})\.\s+(.+)$/;
const TABLE_RULE_CELL = /^:?-+:?$/;

// Splits a line on literal <br> tags, leaving any inside `inline code` alone.
function splitBreaks(line: string): string[] {
  const pattern = /`[^`]*`|<br\s*\/?>/gi;
  const parts: string[] = [];
  let last = 0;
  let match = pattern.exec(line);
  while (match !== null) {
    if (!match[0].startsWith("`")) {
      parts.push(line.slice(last, match.index));
      last = match.index + match[0].length;
    }
    match = pattern.exec(line);
  }
  parts.push(line.slice(last));
  return parts;
}

// A table row as one plain line, or null for the |---| separator row.
function tableRowToLine(row: string): string | null {
  const cells = row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim());
  if (cells.every((cell) => cell === "" || TABLE_RULE_CELL.test(cell))) {
    return null;
  }
  return cells.filter((cell) => cell !== "").join(" — ");
}

// Models often put narrow or no-break spaces between name parts and around
// numbers; in this typeface they render as hairline gaps ("ATAL AI 2.0").
const ODD_SPACES = /[\u00A0\u2007\u2009\u200A\u202F]/g;

/** Replaces narrow and no-break spaces with ordinary ones. */
export function tidySpaces(text: string): string {
  return (
    text
      // A thin space inside a figure ("570 +", "50 – 65 %") is dropped, so
      // the figure stays in one piece; elsewhere it becomes a normal space.
      .replace(/(\d)[\u00A0\u2009\u200A\u202F]+(?=[+%–-])/g, "$1")
      .replace(/([–-])[\u00A0\u2009\u200A\u202F]+(?=\d)/g, "$1")
      .replace(ODD_SPACES, " ")
      .replace(/\u2011/g, "-")
  );
}

export function parseBlocks(rawContent: string, role: MessageRole = "assistant"): Block[] {
  const content = tidySpaces(rawContent);
  if (role === "user") {
    return content === "" ? [] : [{ type: "plain", text: content }];
  }

  const blocks: Block[] = [];
  // How the next line relates to the last block: "tight" directly after a
  // line, "loose" after a blank line, "none" after a fence or rule.
  let join: "tight" | "loose" | "none" = "none";
  let fence: Extract<Block, { type: "code" }> | null = null;
  let fenceLines: string[] = [];

  const lastBlock = () => (join === "none" ? undefined : blocks[blocks.length - 1]);

  const addParagraphLine = (line: string) => {
    const last = lastBlock();
    if (last?.type === "paragraph" && join === "tight") {
      last.lines.push(line);
    } else {
      blocks.push({ type: "paragraph", lines: [line] });
    }
    join = "tight";
  };

  const addLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed === "") {
      join = join === "none" ? "none" : "loose";
      return;
    }
    if (RULE.test(trimmed)) {
      join = "none";
      return;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].replace(/\s+#+$/, ""),
      });
      join = "tight";
      return;
    }

    // Items separated by a blank line still belong to one list.
    const bullet = BULLET.exec(trimmed);
    if (bullet) {
      const last = lastBlock();
      if (last?.type === "ul") {
        last.items.push(bullet[1]);
      } else {
        blocks.push({ type: "ul", items: [bullet[1]] });
      }
      join = "tight";
      return;
    }

    const numbered = NUMBERED.exec(trimmed);
    if (numbered) {
      const last = lastBlock();
      if (last?.type === "ol") {
        last.items.push(numbered[2]);
      } else {
        blocks.push({ type: "ol", start: Number(numbered[1]), items: [numbered[2]] });
      }
      join = "tight";
      return;
    }

    addParagraphLine(trimmed);
  };

  for (const raw of content.replace(/\r\n?/g, "\n").split("\n")) {
    if (fence) {
      if (FENCE_CLOSE.test(raw)) {
        fence.text = fenceLines.join("\n");
        fence.closed = true;
        fence = null;
      } else {
        fenceLines.push(raw);
      }
      continue;
    }

    const open = FENCE_OPEN.exec(raw);
    if (open) {
      fence = { type: "code", lang: open[1], text: "", closed: false };
      fenceLines = [];
      blocks.push(fence);
      join = "none";
      continue;
    }

    if (raw.trimStart().startsWith("|")) {
      const line = tableRowToLine(raw.trim());
      if (line !== null) {
        addParagraphLine(line);
      }
      continue;
    }

    for (const line of splitBreaks(raw)) {
      addLine(line);
    }
  }

  // A fence still open while streaming shows what has arrived so far.
  if (fence) {
    fence.text = fenceLines.join("\n");
  }
  return blocks;
}

function inlineSources(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
      return block.lines;
    case "heading":
      return [block.text];
    case "ul":
    case "ol":
      return block.items;
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Citations                                                            */
/* ------------------------------------------------------------------ */

/**
 * `cited`: distinct numbers rendered as citations, in order of first
 * appearance. `outOfRange`: bracketed numbers that pointed at no source.
 * Counts exactly what MessageBody renders, so code and links are skipped.
 */
export function countCitations(
  text: string,
  maxCite: number,
): { cited: number[]; outOfRange: number } {
  const max = toMaxCite(maxCite);
  const cited: number[] = [];
  let outOfRange = 0;
  for (const block of parseBlocks(text)) {
    for (const line of inlineSources(block)) {
      const scan = scanInline(line, max);
      outOfRange += scan.outOfRange;
      for (const segment of scan.segments) {
        if (segment.type !== "cite") {
          continue;
        }
        for (const n of segment.numbers) {
          if (!cited.includes(n)) {
            cited.push(n);
          }
        }
      }
    }
  }
  return { cited, outOfRange };
}

// Fenced code, inline code and links are matched first and kept, so only
// bare [n] / [n, m] markers are removed. Group 1 is a marker at the start of
// a line (removed with the space after it), group 2 any other marker (removed
// with the space before it).
const STRIP_PATTERN =
  /```[\s\S]*?(?:```|(?![\s\S]))|`[^`\n]*`|\[[^\]\n]+\]\((?:[^()\n]|\([^()\n]*\))*\)|(^[ \t]*(?:\[\s*\d+(?:\s*,\s*\d+)*\s*\](?!\()[ \t]*)+)|((?<![ \t])[ \t]*\[\s*\d+(?:\s*,\s*\d+)*\s*\](?!\())/gm;

/** Removes every [n] marker, whatever its number. Used on chat history. */
export function stripCitations(text: string): string {
  return text.replace(
    STRIP_PATTERN,
    (match: string, atLineStart: string | undefined, inline: string | undefined) =>
      atLineStart !== undefined || inline !== undefined ? "" : match,
  );
}

/* ------------------------------------------------------------------ */
/* Rendering                                                            */
/* ------------------------------------------------------------------ */

function defaultRenderCite(n: number, key: string): ReactNode {
  return (
    <sup key={key} className="cite mx-0.5 font-mono text-[0.75em] leading-none text-muted">
      {n}
    </sup>
  );
}

function renderLink(value: string, href: string, key: string): ReactNode {
  if (!isAllowedHref(href)) {
    return <Fragment key={key}>{value}</Fragment>;
  }
  const className =
    "underline decoration-control underline-offset-[3px] hover:decoration-ink";
  return href.startsWith("https://") ? (
    <a key={key} href={href} target="_blank" rel="noreferrer noopener" className={className}>
      {value}
    </a>
  ) : (
    <a key={key} href={href} className={className}>
      {value}
    </a>
  );
}

function renderInline(
  text: string,
  keyPrefix: string,
  maxCite: number,
  renderCite: CiteRenderer,
): ReactNode[] {
  return scanInline(text, maxCite).segments.map((seg, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (seg.type) {
      case "bold":
        return (
          <strong key={key} className="font-semibold text-ink">
            {seg.value}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic">
            {seg.value}
          </em>
        );
      case "code":
        return (
          <code key={key} className="rounded bg-wash px-1 py-0.5 font-mono text-[0.9em]">
            {seg.value}
          </code>
        );
      case "link":
        return renderLink(seg.value, seg.href, key);
      case "cite":
        return (
          <Fragment key={key}>
            {seg.numbers.map((n, j) => {
              const citeKey = `${key}-${j}`;
              return <Fragment key={citeKey}>{renderCite(n, citeKey)}</Fragment>;
            })}
          </Fragment>
        );
      default:
        return <Fragment key={key}>{seg.value}</Fragment>;
    }
  });
}

export function MessageBody({
  content,
  role,
  sourceCount,
  renderCite = defaultRenderCite,
}: Readonly<MessageBodyProps>) {
  const maxCite = toMaxCite(sourceCount);
  const inline = (text: string, key: string) => renderInline(text, key, maxCite, renderCite);

  return (
    <div className="min-w-0 space-y-3 wrap-anywhere">
      {parseBlocks(content, role).map((block, index) => {
        const key = `block-${index}`;
        switch (block.type) {
          case "plain":
            return (
              <p key={key} className="whitespace-pre-wrap leading-[1.6]">
                {block.text}
              </p>
            );
          case "heading":
            return (
              <p key={key} className="font-semibold leading-[1.6] text-ink">
                {inline(block.text, key)}
              </p>
            );
          case "ul":
            return (
              <ul key={key} className="list-disc space-y-1 pl-5 leading-[1.6] marker:text-muted">
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={key}
                start={block.start}
                className="list-decimal space-y-1 pl-5 leading-[1.6] marker:text-muted"
              >
                {block.items.map((item, i) => (
                  <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre
                key={key}
                className="max-w-full overflow-x-auto rounded bg-wash p-3 font-mono text-[13px] leading-[1.5]"
              >
                <code>{block.text}</code>
              </pre>
            );
          default:
            return (
              <p key={key} className="leading-[1.6]">
                {block.lines.map((line, i) => (
                  <Fragment key={`${key}-${i}`}>
                    {i > 0 ? <br /> : null}
                    {inline(line, `${key}-${i}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
