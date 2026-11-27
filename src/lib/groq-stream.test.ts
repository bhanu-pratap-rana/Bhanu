import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUT_OFF_SUFFIX,
  openModelStream,
  parseSseDeltas,
  textStream,
} from "./groq-stream";

const encoder = new TextEncoder();

function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

const ROLE_ONLY = `data: ${JSON.stringify({
  choices: [{ delta: { role: "assistant" } }],
})}\n\n`;
const EMPTY_DELTA = `data: ${JSON.stringify({
  choices: [{ delta: { content: "" } }],
})}\n\n`;
const DONE = "data: [DONE]\n\n";
const finish = (reason: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: reason }] })}\n\n`;
const STOP = finish("stop");
const LENGTH_STOP = finish("length");

let warnings: unknown[][];
beforeEach(() => {
  warnings = [];
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warnings.push(args);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Upstream = {
  body: ReadableStream<Uint8Array>;
  cancelled: () => unknown;
  pulls: () => number;
};

// One chunk per pull, like a network body. `failAfter` makes the read that
// follows the last chunk reject instead of ending the stream.
function upstream(
  chunks: (string | Uint8Array)[],
  options: { failAfter?: boolean } = {},
): Upstream {
  let index = 0;
  let cancelReason: unknown;
  let wasCancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        const chunk = chunks[index++];
        controller.enqueue(
          typeof chunk === "string" ? encoder.encode(chunk) : chunk,
        );
        return;
      }
      index++;
      if (options.failAfter) {
        controller.error(new Error("socket hang up"));
        return;
      }
      controller.close();
    },
    cancel(reason) {
      wasCancelled = true;
      cancelReason = reason;
    },
  });
  return {
    body,
    cancelled: () => (wasCancelled ? (cancelReason ?? true) : false),
    pulls: () => index,
  };
}

// Fails the test instead of hanging when a stream stalls.
async function readAll(
  stream: ReadableStream<Uint8Array>,
  timeoutMs = 1000,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("stream stalled")), timeoutMs);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), stalled]);
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    clearTimeout(timer);
  }
}

async function open(chunks: (string | Uint8Array)[], failAfter = false) {
  const source = upstream(chunks, { failAfter });
  const result = await openModelStream(source.body);
  return { source, result };
}

describe("parseSseDeltas", () => {
  it("extracts content from several frames in one buffer", () => {
    const parsed = parseSseDeltas(frame("Hello") + frame(", ") + frame("world"));
    expect(parsed).toEqual({
      deltas: ["Hello", ", ", "world"],
      rest: "",
      done: false,
      failed: false,
      truncated: false,
    });
  });

  it("reports a token-limit stop, even when [DONE] follows in the same buffer", () => {
    const parsed = parseSseDeltas(frame("a") + LENGTH_STOP + DONE);
    expect(parsed.deltas).toEqual(["a"]);
    expect(parsed.done).toBe(true);
    expect(parsed.truncated).toBe(true);
    expect(parseSseDeltas(frame("a") + STOP + DONE).truncated).toBe(false);
  });

  it("keeps an incomplete trailing frame as the remainder", () => {
    const whole = frame("Hello");
    const cut = whole.slice(0, 20);
    const parsed = parseSseDeltas(frame("A") + cut);
    expect(parsed.deltas).toEqual(["A"]);
    expect(parsed.rest).toBe(cut);
    const resumed = parseSseDeltas(parsed.rest + whole.slice(20));
    expect(resumed.deltas).toEqual(["Hello"]);
    expect(resumed.rest).toBe("");
  });

  it("flushes a trailing unterminated frame when told the stream ended", () => {
    const unterminated = frame("tail").trimEnd();
    expect(parseSseDeltas(unterminated).deltas).toEqual([]);
    const flushed = parseSseDeltas(unterminated, true);
    expect(flushed.deltas).toEqual(["tail"]);
    expect(flushed.rest).toBe("");
  });

  it("handles CRLF line endings", () => {
    const crlf = (frame("one") + frame("two") + DONE).replace(/\n/g, "\r\n");
    const parsed = parseSseDeltas(crlf);
    expect(parsed.deltas).toEqual(["one", "two"]);
    expect(parsed.done).toBe(true);
  });

  it("accepts data lines with and without the optional space", () => {
    const tight = `data:${JSON.stringify({ choices: [{ delta: { content: "x" } }] })}\n\n`;
    expect(parseSseDeltas(tight).deltas).toEqual(["x"]);
  });

  it("skips keep-alive comments, other fields, role-only and empty deltas", () => {
    const parsed = parseSseDeltas(
      ": keep-alive\n\n" +
        "event: message\nid: 7\n" +
        ROLE_ONLY +
        EMPTY_DELTA +
        `data: ${JSON.stringify({ choices: [] })}\n\n` +
        `data: ${JSON.stringify({ choices: [{ delta: { content: null } }] })}\n\n` +
        `data: ${JSON.stringify({ x_groq: { usage: {} } })}\n\n` +
        frame("text"),
    );
    expect(parsed.deltas).toEqual(["text"]);
    expect(parsed.failed).toBe(false);
  });

  it("skips malformed JSON without losing later frames", () => {
    const parsed = parseSseDeltas(
      "data: {not json\n\n" + "data: 42\n\n" + 'data: "str"\n\n' + frame("ok"),
    );
    expect(parsed.deltas).toEqual(["ok"]);
  });

  it("stops at [DONE] and ignores anything after it", () => {
    const parsed = parseSseDeltas(frame("a") + DONE + frame("late"));
    expect(parsed.deltas).toEqual(["a"]);
    expect(parsed.done).toBe(true);
    expect(parsed.rest).toBe("");
  });

  it("reads only delta.content, never the reasoning fields", () => {
    const reasoning = `data: ${JSON.stringify({
      choices: [
        {
          delta: { reasoning: "secret scratchpad", reasoning_content: "more" },
        },
      ],
    })}\n\n`;
    const mixed = `data: ${JSON.stringify({
      choices: [{ delta: { reasoning: "hidden", content: "shown" } }],
    })}\n\n`;
    expect(parseSseDeltas(reasoning + mixed).deltas).toEqual(["shown"]);
  });

  it("reports an in-stream error frame", () => {
    const parsed = parseSseDeltas(
      frame("partial") +
        `event: error\ndata: ${JSON.stringify({
          error: { message: "over capacity", type: "server_error" },
        })}\n\n` +
        frame("never"),
    );
    expect(parsed.deltas).toEqual(["partial"]);
    expect(parsed.failed).toBe(true);
  });

  it("reports an error event even when its payload is not JSON", () => {
    const parsed = parseSseDeltas("event: error\ndata: upstream timeout\n\n");
    expect(parsed).toEqual({
      deltas: [],
      rest: "",
      done: false,
      failed: true,
      truncated: false,
    });
  });

  it("holds back a lone trailing CR until the next chunk decides what it is", () => {
    const first = parseSseDeltas(frame("a").replace(/\n/g, "\r\n").slice(0, -1));
    expect(first.deltas).toEqual([]);
    expect(first.rest.endsWith("\r")).toBe(true);
    expect(parseSseDeltas(first.rest + "\n").deltas).toEqual(["a"]);
  });
});

describe("textStream", () => {
  it("emits the text once and closes", async () => {
    expect(await readAll(textStream("नमस्ते, offline"))).toBe("नमस्ते, offline");
  });
});

describe("openModelStream", () => {
  it("streams the content of a normal completion", async () => {
    const { result } = await open([
      ROLE_ONLY,
      frame("Hello"),
      frame(" world"),
      DONE,
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("Hello world");
  });

  it("does not resolve until real content exists, and reads no further", async () => {
    const source = upstream([
      ROLE_ONLY,
      EMPTY_DELTA,
      frame("first"),
      frame("second"),
      DONE,
    ]);
    const result = await openModelStream(source.body);
    expect(result.ok).toBe(true);
    // Three chunks were needed for the first text; the rest waits for a reader.
    expect(source.pulls()).toBeLessThanOrEqual(4);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("firstsecond");
  });

  it("does not stall on empty-delta chunks in the middle of an answer", async () => {
    const { result } = await open([
      frame("a"),
      ROLE_ONLY,
      EMPTY_DELTA,
      ": keep-alive\n\n",
      EMPTY_DELTA,
      ROLE_ONLY,
      frame("b"),
      EMPTY_DELTA,
      EMPTY_DELTA,
      DONE,
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("ab");
  });

  it("joins a frame split across chunks", async () => {
    const whole = frame("split") + frame(" frame") + DONE;
    const chunks = [whole.slice(0, 9), whole.slice(9, 31), whole.slice(31)];
    const { result } = await open(chunks);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("split frame");
  });

  it("survives a stream delivered one byte at a time", async () => {
    const bytes = encoder.encode(ROLE_ONLY + frame("tiny") + frame(" bits") + DONE);
    const { result } = await open([...bytes].map((byte) => Uint8Array.of(byte)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream, 3000)).toBe("tiny bits");
  });

  it("handles CRLF streams, including a CRLF split across chunks", async () => {
    const whole = (frame("one") + frame(" two") + DONE).replace(/\n/g, "\r\n");
    const cut = whole.indexOf("\r\n") + 1;
    const { result } = await open([whole.slice(0, cut), whole.slice(cut)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("one two");
  });

  it("decodes Devanagari split across chunk boundaries", async () => {
    const text = "नमस्ते, भानु एक AI इंजीनियर हैं।";
    const bytes = encoder.encode(frame(text) + DONE);
    // Three-byte code points: cutting every 4 bytes lands inside characters.
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 4) chunks.push(bytes.slice(i, i + 4));
    const { result } = await open(chunks);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream, 3000)).toBe(text);
  });

  it("flushes a final frame that has no terminating newline", async () => {
    const { result } = await open([frame("a"), frame("tail").trimEnd()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("atail");
  });

  it("reports empty when [DONE] arrives with no content", async () => {
    expect((await open([ROLE_ONLY, EMPTY_DELTA, DONE])).result).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("releases the upstream when it gives up on an empty answer", async () => {
    // Trailing chunks keep the fixture open, so the cancel is observable.
    const { source, result } = await open([
      ROLE_ONLY,
      DONE,
      ": keep-alive\n\n",
      ": keep-alive\n\n",
    ]);
    expect(result).toEqual({ ok: false, reason: "empty" });
    expect(source.cancelled()).not.toBe(false);
  });

  it("gives up on a body that never completes a frame", async () => {
    const junk = "x".repeat(64 * 1024);
    const source = upstream(Array.from({ length: 8 }, () => junk));
    const result = await openModelStream(source.body);
    expect(result).toEqual({ ok: false, reason: "error" });
    expect(source.pulls()).toBeLessThan(8);
  });

  it("reports error for a Groq x_groq error frame before any content", async () => {
    const errorFrame = `data: ${JSON.stringify({
      choices: [],
      x_groq: { error: "over capacity" },
    })}\n\n`;
    const { result } = await open([ROLE_ONLY, errorFrame, frame("never")]);
    expect(result).toEqual({ ok: false, reason: "error" });
  });

  it("ends a pending read when the consumer cancels while the model is silent", async () => {
    let release: (() => void) | undefined;
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        if (pulls === 1) {
          controller.enqueue(encoder.encode(frame("a")));
          return;
        }
        // Hangs like a slow model until the test lets it go.
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    const result = await openModelStream(body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reader = result.stream.getReader();
    expect((await reader.read()).done).toBe(false);
    const pending = reader.read();
    await reader.cancel();
    expect((await pending).done).toBe(true);
    release?.();
  });

  it("reports empty when the stream just ends with no content", async () => {
    expect((await open([ROLE_ONLY])).result).toEqual({
      ok: false,
      reason: "empty",
    });
    expect((await open([])).result).toEqual({ ok: false, reason: "empty" });
  });

  it("reports empty when the only output is hidden reasoning", async () => {
    const reasoning = `data: ${JSON.stringify({
      choices: [{ delta: { reasoning: "thinking for the whole budget" } }],
    })}\n\n`;
    const { result } = await open([reasoning, reasoning, DONE]);
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("treats whitespace-only output as empty", async () => {
    const { result } = await open([frame("\n"), frame("  "), DONE]);
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("keeps leading whitespace when real text follows", async () => {
    const { result } = await open([frame("\n"), frame("Hi"), DONE]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("\nHi");
  });

  it("reports error when the upstream fails before any content", async () => {
    const { result } = await open([ROLE_ONLY], true);
    expect(result).toEqual({ ok: false, reason: "error" });
  });

  it("reports error for an in-stream error frame before any content", async () => {
    const errorFrame = `data: ${JSON.stringify({
      error: { message: "over capacity" },
    })}\n\n`;
    const { result } = await open([ROLE_ONLY, errorFrame]);
    expect(result).toEqual({ ok: false, reason: "error" });
  });

  it("emits the text it has, marks it cut off, then closes cleanly, when the upstream fails mid-answer", async () => {
    const { result } = await open([frame("partial"), frame(" answer")], true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // readAll rejects if the stream errors instead of closing.
    expect(await readAll(result.stream)).toBe("partial answer" + CUT_OFF_SUFFIX);
    expect(JSON.stringify(warnings)).toMatch(/read-error/);
  });

  it("adds no notice and logs nothing when the visitor stopped the answer", async () => {
    const source = upstream([frame("only this")], { failAfter: true });
    let gone = false;
    const result = await openModelStream(source.body, { isClientGone: () => gone });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    gone = true;
    expect(await readAll(result.stream)).toBe("only this");
    expect(warnings).toEqual([]);
  });

  it("marks the answer cut off when the body errors right after one delta", async () => {
    const { result } = await open([frame("only this")], true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("only this" + CUT_OFF_SUFFIX);
  });

  it("marks the answer cut off on an in-stream error frame after partial output", async () => {
    const errorFrame = `data: ${JSON.stringify({
      error: { message: "over capacity" },
    })}\n\n`;
    const { result } = await open([frame("partial"), errorFrame, frame("x")]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("partial" + CUT_OFF_SUFFIX);
  });

  it("marks the answer cut off when the error frame shares the first text's chunk", async () => {
    const errorFrame = `data: ${JSON.stringify({ error: { message: "x" } })}\n\n`;
    const { result } = await open([frame("early") + errorFrame]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("early" + CUT_OFF_SUFFIX);
  });

  it("marks the answer cut off when the model hit its token limit", async () => {
    const { result } = await open([frame("long"), frame(" answer"), LENGTH_STOP, DONE]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("long answer" + CUT_OFF_SUFFIX);
    expect(JSON.stringify(warnings)).toMatch(/length/);
  });

  it("marks the answer cut off when the buffer overflows after partial output", async () => {
    const junk = "x".repeat(64 * 1024);
    const { result } = await open([frame("start"), ...Array.from({ length: 8 }, () => junk)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("start" + CUT_OFF_SUFFIX);
    expect(JSON.stringify(warnings)).toMatch(/overflow/);
  });

  it("adds no suffix to an answer that ends with [DONE]", async () => {
    const { result } = await open([frame("whole"), frame(" answer"), STOP, DONE]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("whole answer");
    expect(warnings).toEqual([]);
  });

  it("logs no answer text when it marks one cut off", async () => {
    const { result } = await open([frame("SECRET partial")], true);
    if (!result.ok) throw new Error("expected a stream");
    await readAll(result.stream);
    expect(JSON.stringify(warnings)).not.toMatch(/SECRET/);
  });

  it("cancels the upstream when the consumer cancels", async () => {
    const source = upstream([frame("a"), frame("b"), frame("c"), DONE]);
    const result = await openModelStream(source.body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reader = result.stream.getReader();
    await reader.read();
    await reader.cancel("client went away");
    expect(source.cancelled()).toBe("client went away");
  });

  it("releases the upstream once [DONE] has been seen", async () => {
    // A server that keeps the socket open after [DONE] must not hold the answer open.
    let cancelled = false;
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent) return new Promise<void>(() => {});
        sent = true;
        controller.enqueue(encoder.encode(frame("done soon") + DONE));
      },
      cancel() {
        cancelled = true;
      },
    });
    const result = await openModelStream(body);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readAll(result.stream)).toBe("done soon");
    expect(cancelled).toBe(true);
  });
});
