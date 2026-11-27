// Turns Groq's OpenAI-style SSE body into a plain-text stream.
//
// The route must know whether a model produced any text BEFORE it sends the
// response headers: a 200 with an empty body would be labelled as that model
// while the visitor sees nothing. `openModelStream` therefore peeks until the
// first real text and reports "no text" as a failure the caller can act on.

export type SseParse = {
  /** Non-empty `choices[0].delta.content` values, in order. */
  deltas: string[];
  /** Unconsumed tail (an incomplete frame) to prepend to the next chunk. */
  rest: string;
  /** `[DONE]` was seen; nothing after it is read. */
  done: boolean;
  /** The provider sent an in-stream error frame. */
  failed: boolean;
  /** A frame ended the answer with `finish_reason: "length"` (token budget). */
  truncated: boolean;
};

// Appended when an answer stops early, so a cut-off reply never reads as a
// finished one. Markdown, like the model's own output.
export { CUT_OFF_SUFFIX } from "./chat-request";
import { CUT_OFF_SUFFIX } from "./chat-request";

export type ModelStreamResult =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; reason: "empty" | "error" };

// A single frame is a few hundred bytes. A body that never completes a frame
// is not SSE, and must not grow the buffer without bound.
const MAX_PENDING_CHARS = 256 * 1024;

const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deltaContent(payload: Record<string, unknown>): string {
  const choices = payload.choices;
  if (!Array.isArray(choices) || !isRecord(choices[0])) return "";
  const delta = choices[0].delta;
  if (!isRecord(delta)) return "";
  // Only `content`: `reasoning` / `reasoning_content` are the model's scratchpad.
  return typeof delta.content === "string" ? delta.content : "";
}

function hitTokenLimit(payload: Record<string, unknown>): boolean {
  const choices = payload.choices;
  return (
    Array.isArray(choices) &&
    isRecord(choices[0]) &&
    choices[0].finish_reason === "length"
  );
}

/**
 * Incremental SSE parser. Feed it `rest + nextChunk`; pass `flush` once the
 * stream has ended so a final frame without a blank line is still read.
 */
export function parseSseDeltas(buffer: string, flush = false): SseParse {
  let text = buffer.replace(/\r\n/g, "\n");
  let held = "";
  // A lone trailing CR may be the first half of a CRLF split across chunks.
  if (!flush && text.endsWith("\r")) {
    held = "\r";
    text = text.slice(0, -1);
  }
  text = text.replace(/\r/g, "\n");

  const frames = text.split("\n\n");
  const tail = frames.pop() ?? "";
  if (flush && tail.trim()) frames.push(tail);

  const deltas: string[] = [];
  let truncated = false;
  for (const frame of frames) {
    let eventName = "";
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""));
      } else if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      }
      // Comments (": keep-alive"), "id:" and "retry:" carry no text.
    }
    if (dataLines.length === 0) continue;

    const data = dataLines.join("\n").trim();
    if (data === "[DONE]") {
      return { deltas, rest: "", done: true, failed: false, truncated };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      // A malformed frame is skipped; an "error" event is a failure either way.
      if (eventName === "error") {
        return { deltas, rest: "", done: false, failed: true, truncated };
      }
      continue;
    }
    if (eventName === "error") {
      return { deltas, rest: "", done: false, failed: true, truncated };
    }
    if (!isRecord(payload)) continue;
    // Groq reports a mid-stream failure as `error` or as `x_groq.error`.
    if (payload.error || (isRecord(payload.x_groq) && payload.x_groq.error)) {
      return { deltas, rest: "", done: false, failed: true, truncated };
    }

    const content = deltaContent(payload);
    if (content) deltas.push(content);
    if (hitTokenLimit(payload)) truncated = true;
  }

  return {
    deltas,
    rest: flush ? "" : tail + held,
    done: false,
    failed: false,
    truncated,
  };
}

export function textStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (text) controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/**
 * Reads the upstream SSE body until the first non-blank text. Resolves
 * `{ ok: false }` when the model ends, errors or sends `[DONE]` before saying
 * anything, so the caller can try the next model. Otherwise resolves with a
 * text stream that starts with the text already read.
 */
export async function openModelStream(
  body: ReadableStream<Uint8Array>,
  options: {
    /** The visitor stopped the answer: an early end is theirs, not a cut-off. */
    isClientGone?: () => boolean;
  } = {},
): Promise<ModelStreamResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  let ended = false;
  let failed = false;
  // Why the answer stopped early, if it did; logged, never shown.
  let cutReason: "read-error" | "error-frame" | "overflow" | "length" | null =
    null;

  const release = (reason?: unknown) =>
    reader.cancel(reason).catch(() => undefined);

  // Reads one upstream chunk and returns the text it completed (often "").
  async function readChunk(): Promise<string> {
    let result: ReadableStreamReadResult<Uint8Array>;
    try {
      result = await reader.read();
    } catch {
      // Also how the route's stop timer lands: it aborts the fetch.
      ended = true;
      failed = true;
      cutReason = "read-error";
      return "";
    }

    const parsed = result.done
      ? parseSseDeltas(rest + decoder.decode(), true)
      : parseSseDeltas(rest + decoder.decode(result.value, { stream: true }));
    rest = parsed.rest;
    if (parsed.truncated) cutReason = "length";

    if (result.done) {
      ended = true;
      failed = parsed.failed;
      if (parsed.failed) cutReason = "error-frame";
    } else if (parsed.done || parsed.failed || rest.length > MAX_PENDING_CHARS) {
      // Do not wait for a server that keeps the socket open after [DONE].
      ended = true;
      failed = !parsed.done;
      if (parsed.failed) cutReason = "error-frame";
      else if (!parsed.done) cutReason = "overflow";
      void release();
    }
    return parsed.deltas.join("");
  }

  // Ends the visitor's stream. A cut-off answer keeps the text that did
  // arrive but says it is incomplete, instead of passing as a full reply.
  function finish(controller: ReadableStreamDefaultController<Uint8Array>) {
    if (cutReason && !options.isClientGone?.()) {
      console.warn("groq stream cut off", { reason: cutReason });
      controller.enqueue(encoder.encode(CUT_OFF_SUFFIX));
    }
    controller.close();
  }

  let peeked = "";
  while (!peeked.trim()) {
    if (ended) {
      await release();
      return { ok: false, reason: failed ? "error" : "empty" };
    }
    peeked += await readChunk();
  }

  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(peeked));
      if (ended) finish(controller);
    },
    // Must not return before it has enqueued or closed: the stream only pulls
    // again after an enqueue, so a chunk that held no text (role-only delta,
    // keep-alive, half a frame) would otherwise stall the reader for good.
    async pull(controller) {
      for (;;) {
        if (cancelled) return;
        if (ended) {
          // An upstream failure after partial output still ends the answer
          // cleanly: the visitor keeps the text that did arrive.
          finish(controller);
          return;
        }
        const text = await readChunk();
        if (cancelled) return;
        if (text) {
          controller.enqueue(encoder.encode(text));
          if (ended) finish(controller);
          return;
        }
      }
    },
    cancel(reason) {
      cancelled = true;
      ended = true;
      return release(reason);
    },
  });

  return { ok: true, stream };
}
