import { Fragment, type ReactNode } from "react";

// Lightweight markdown renderer for chat answers. Handles the subset the model
// actually emits: **bold**, `code`, [links](url), headings, and bullet/numbered
// lists. No external dependency so the bundle stays small.

export type InlineSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string };

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**")) {
      segments.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      segments.push({ type: "code", value: token.slice(1, -1) });
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        segments.push({ type: "link", value: link[1], href: link[2] });
      } else {
        segments.push({ type: "text", value: token });
      }
    }
    lastIndex = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return parseInline(text).map((seg, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (seg.type) {
      case "bold":
        return (
          <strong key={key} className="font-semibold text-stone-950">
            {seg.value}
          </strong>
        );
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] text-stone-800"
          >
            {seg.value}
          </code>
        );
      case "link":
        return seg.href.startsWith("http") ? (
          <a
            key={key}
            href={seg.href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-stone-950"
          >
            {seg.value}
          </a>
        ) : (
          <Fragment key={key}>{seg.value}</Fragment>
        );
      default:
        return <Fragment key={key}>{seg.value}</Fragment>;
    }
  });
}

export function MessageBody({
  content,
  role,
}: Readonly<{ content: string; role: "user" | "assistant" }>) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        const key = `line-${index}`;
        if (!trimmed) {
          return <div key={key} className="h-2" />;
        }

        const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
        if (role === "assistant" && heading) {
          return (
            <p key={key} className="text-sm font-semibold text-stone-950">
              {renderInline(heading[2], key)}
            </p>
          );
        }

        const bullet = /^[-*]\s+(.+)/.exec(trimmed);
        if (role === "assistant" && bullet) {
          return (
            <div key={key} className="mb-2 flex gap-2 last:mb-0">
              <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
              <p>{renderInline(bullet[1], key)}</p>
            </div>
          );
        }

        const numbered = /^(\d+)\.\s+(.+)/.exec(trimmed);
        if (role === "assistant" && numbered) {
          return (
            <div
              key={key}
              className="mb-3 grid grid-cols-[1.75rem_1fr] gap-2 last:mb-0"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-100 font-mono text-xs text-stone-500">
                {numbered[1]}
              </span>
              <p>{renderInline(numbered[2], key)}</p>
            </div>
          );
        }

        return (
          <p key={key} className="mb-2 last:mb-0">
            {renderInline(trimmed, key)}
          </p>
        );
      })}
    </div>
  );
}
