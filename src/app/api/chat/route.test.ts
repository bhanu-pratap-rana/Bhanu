import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// End-to-end checks of the chat route with Groq mocked: the model walk, the
// honest fallback labels, timeouts, validation and what gets logged.

type SentBody = {
  model: string;
  max_completion_tokens: number;
  temperature: number;
  stream: boolean;
  messages: { role: string; content: string }[];
  [key: string]: unknown;
};

const enc = new TextEncoder();
const frame = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
const DONE = "data: [DONE]\n\n";

function sse(chunks: string[]): Response {
  let i = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(c) {
        if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]));
        else c.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}
const fail = (status: number, code: string) =>
  new Response(JSON.stringify({ error: { code, message: "SECRET user text echoed" } }), { status });

let ip = 0;
function post(body: unknown, headers: Record<string, string> = {}, init: RequestInit = {}) {
  return new Request("https://site.example/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.0.0.${++ip}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}
const question = { mode: "default", messages: [{ role: "user", content: "Tell me about ATAL AI and RAG" }] };

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return (await import("@/app/api/chat/route")) as { POST: (r: Request) => Promise<Response>; maxDuration: number };
}

describe("POST /api/chat", () => {
  let logs: unknown[][];
  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => logs.push(args));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("exports maxDuration 30", async () => {
    expect((await load({ GROQ_API_KEY: undefined })).maxDuration).toBe(30);
  });

  it("answers from the index without a key, labelled as fallback", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load({ GROQ_API_KEY: undefined, GROQ_MODEL: undefined });
    const res = await POST(post(question));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-provider")).toBe("local-rag-fallback");
    expect(res.headers.get("x-warning")).toBe("groq-not-configured");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("server-timing")).toMatch(/^retrieval;dur=[\d.]+, attempts;dur=0\.0$/);
    const sources = JSON.parse(decodeURIComponent(res.headers.get("x-sources")!));
    expect(Array.isArray(sources)).toBe(true);
    expect(sources[0]).toHaveProperty("id");
    expect((await res.text()).length).toBeGreaterThan(20);
    expect(fetchMock).not.toHaveBeenCalled();
    console.log("X-Retrieval:", res.headers.get("x-retrieval"), "| note:", res.headers.get("x-retrieval-note"));
  });

  it("walks past a retired model, streams the next, and remembers", async () => {
    const calls: SentBody[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as SentBody;
      calls.push(body);
      if (body.model === "custom/gone") return fail(404, "model_not_found");
      return sse([frame("Hello"), frame(" नमस्ते [1]"), DONE]);
    }));
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: "custom/gone" });
    const res = await POST(post(question));
    expect(res.headers.get("x-provider")).toBe("groq:openai/gpt-oss-120b");
    expect(res.headers.get("x-warning")).toBeNull();
    expect(res.headers.get("server-timing")).toMatch(/^retrieval;dur=[\d.]+, ttft;dur=[\d.]+$/);
    expect(await res.text()).toBe("Hello नमस्ते [1]");
    expect(calls.map((c) => c.model)).toEqual(["custom/gone", "openai/gpt-oss-120b"]);

    const sent = calls[1];
    expect(sent.temperature).toBe(0.2);
    expect(sent.max_completion_tokens).toBe(1200);
    expect(sent.stream).toBe(true);
    expect(sent.include_reasoning).toBe(false);
    expect(sent.messages.filter((m) => m.role === "system")).toHaveLength(1);
    expect(sent.messages[0].content).toMatch(/portfolio assistant for Bhanu Pratap Rana/);
    expect(sent.messages.at(-1)).toEqual({ role: "user", content: question.messages[0].content });

    await (await POST(post(question))).text();
    expect(calls.map((c) => c.model)).toEqual(["custom/gone", "openai/gpt-oss-120b", "openai/gpt-oss-120b"]);
    // Logs carry status, model and code only.
    expect(JSON.stringify(logs)).not.toMatch(/SECRET|ATAL/);
    expect(JSON.stringify(logs)).toMatch(/model_not_found/);
  });

  it("labels an all-429 failure as quota", async () => {
    const fetchMock = vi.fn(async () => fail(429, "rate_limit_exceeded"));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });
    const res = await POST(post(question));
    expect(res.headers.get("x-provider")).toBe("local-rag-fallback:quota");
    expect(res.headers.get("x-warning")).toBe("groq-quota");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await res.text()).length).toBeGreaterThan(20);
    // Not retired: the next request tries both again.
    await POST(post(question));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("is not quota when failures are mixed", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (n++ === 0 ? fail(429, "rate_limit_exceeded") : fail(503, "x"))));
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });
    const res = await POST(post(question));
    expect(res.headers.get("x-provider")).toBe("local-rag-fallback");
    expect(res.headers.get("x-warning")).toBe("groq-failed");
  });

  it("moves on when a model returns 200 but no text", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () =>
      n++ === 0
        ? sse([`data: ${JSON.stringify({ choices: [{ delta: { role: "assistant", reasoning: "hmm" } }] })}\n\n`, DONE])
        : sse([frame("real answer"), DONE]),
    ));
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });
    const res = await POST(post(question));
    expect(res.headers.get("x-provider")).toBe("groq:openai/gpt-oss-20b");
    expect(await res.text()).toBe("real answer");
  });

  it("stops on an auth error", async () => {
    const fetchMock = vi.fn(async () => fail(401, "invalid_api_key"));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });
    const res = await POST(post(question));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.headers.get("x-provider")).toBe("local-rag-fallback");
    expect(res.headers.get("x-warning")).toBe("groq-failed");
  });

  it("falls back as unreachable when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });
    const res = await POST(post(question));
    expect(res.headers.get("x-provider")).toBe("local-rag-fallback");
    expect(res.headers.get("x-warning")).toBe("groq-unreachable");
  });

  it("times out a model that never sends headers and tries the next", async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => {
      if (n++ === 0) {
        return new Promise((_, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      return Promise.resolve(sse([frame("late but fine"), DONE]));
    }));
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });
    const pending = POST(post(question));
    await vi.advanceTimersByTimeAsync(12_001);
    const res = await pending;
    expect(res.headers.get("x-provider")).toBe("groq:openai/gpt-oss-20b");
    expect(await res.text()).toBe("late but fine");
    expect(JSON.stringify(logs)).toMatch(/timeout/);
  });

  it("times out a model that sends headers but never any text", async () => {
    vi.useFakeTimers();
    let n = 0;
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => {
      if (n++ === 0) {
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            init.signal!.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError")));
          },
        });
        return Promise.resolve(new Response(body, { status: 200 }));
      }
      return Promise.resolve(sse([frame("second model"), DONE]));
    }));
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });
    const pending = POST(post(question));
    await vi.advanceTimersByTimeAsync(12_001);
    const res = await pending;
    expect(res.headers.get("x-provider")).toBe("groq:openai/gpt-oss-20b");
    expect(await res.text()).toBe("second model");
  });

  it("returns 499 without walking on when the client aborts", async () => {
    const client = new AbortController();
    const fetchMock = vi.fn((_u: string, init: RequestInit) =>
      new Promise((_, reject) => {
        init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });
    const pending = POST(post(question, {}, { signal: client.signal }));
    await new Promise((r) => setTimeout(r, 20));
    client.abort();
    const res = await pending;
    expect(res.status).toBe(499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects cross-site, oversize, malformed and empty requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load({ GROQ_API_KEY: "k", GROQ_MODEL: undefined });

    const cross = await POST(post(question, { "sec-fetch-site": "cross-site", origin: "https://evil.example", host: "site.example" }));
    expect(cross.status).toBe(403);
    expect(await cross.json()).toHaveProperty("error");

    const same = await POST(post("{bad", { "sec-fetch-site": "same-origin" }));
    expect(same.status).toBe(400);

    const big = await POST(post({ messages: [{ role: "user", content: "x".repeat(70_000) }] }));
    expect(big.status).toBe(413);
    expect(await big.json()).toHaveProperty("error");

    const declared = await POST(post(question, { "content-length": "999999" }));
    expect(declared.status).toBe(413);

    const empty = await POST(post({ messages: [{ role: "assistant", content: "hi" }] }));
    expect(empty.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate limits with Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { POST } = await load({ GROQ_API_KEY: undefined, GROQ_MODEL: undefined });
    let last: Response | undefined;
    for (let i = 0; i < 16; i++) {
      last = await POST(new Request("https://site.example/api/chat", {
        method: "POST",
        headers: { "x-forwarded-for": "10.9.9.9" },
        body: JSON.stringify(question),
      }));
    }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await last!.json()).toHaveProperty("error");
  });
});
