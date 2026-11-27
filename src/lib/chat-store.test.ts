import { describe, expect, it } from "vitest";
import {
  createChatStore,
  historyFor,
  persistableMessages,
  reviveMessages,
  STORAGE_KEY,
  type ChatMessage,
} from "./chat-store";
import { CUT_OFF_SUFFIX } from "./chat-request";
import { jobDescriptionPrompt } from "./knowledge";

const encoder = new TextEncoder();

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function okResponse(chunks: string[], headers: Record<string, string> = {}) {
  return new Response(streamOf(chunks), {
    status: 200,
    headers: { "X-Provider": "groq:openai/gpt-oss-120b", ...headers },
  });
}

function storeWith(fetchImpl: typeof fetch) {
  const storage = memoryStorage();
  let id = 0;
  const store = createChatStore({
    fetch: fetchImpl,
    storage: () => storage,
    schedule: (flush) => flush(),
    newId: () => `id-${(id += 1)}`,
    now: () => 1000,
  });
  return { store, storage };
}

const question: ChatMessage = {
  id: "q1",
  role: "user",
  kind: "question",
  content: "How did he build Aura AI?",
};
const answer: ChatMessage = {
  id: "a1",
  role: "assistant",
  kind: "answer",
  content: "He designed it on FastAPI [1].",
  sources: ["aura-ai"],
};

describe("reviveMessages", () => {
  it("restores a well-formed thread", () => {
    const revived = reviveMessages({ v: 2, messages: [question, answer] });
    expect(revived.map((message) => message.id)).toEqual(["q1", "a1"]);
    expect(revived[1].sources).toEqual(["aura-ai"]);
  });

  it("rejects other versions and malformed payloads", () => {
    expect(reviveMessages({ v: 1, messages: [question, answer] })).toEqual([]);
    expect(reviveMessages(null)).toEqual([]);
    expect(reviveMessages([question])).toEqual([]);
    expect(reviveMessages({ v: 2, messages: "nope" })).toEqual([]);
  });

  it("drops unknown note ids, notices and dangling questions", () => {
    const revived = reviveMessages({
      v: 2,
      messages: [
        { id: "n", role: "assistant", kind: "notice", content: "Stopped." },
        question,
        { ...answer, sources: ["aura-ai", "not-a-note", 7] },
        { id: "q2", role: "user", kind: "question", content: "And then?" },
      ],
    });
    expect(revived.map((message) => message.id)).toEqual(["q1", "a1"]);
    expect(revived[1].sources).toBeUndefined();
  });
});

describe("persistableMessages", () => {
  it("never stores a long paste or anything after it", () => {
    const paste: ChatMessage = {
      id: "q2",
      role: "user",
      kind: "question",
      content: "x".repeat(1200),
    };
    const kept = persistableMessages([question, answer, paste, { ...answer, id: "a2" }]);
    expect(kept.map((message) => message.id)).toEqual(["q1", "a1"]);
  });

  it("skips notices", () => {
    const notice: ChatMessage = {
      id: "n1",
      role: "assistant",
      kind: "notice",
      content: "Too many questions.",
    };
    expect(persistableMessages([question, notice])).toEqual([]);
  });
});

describe("historyFor", () => {
  it("sends real questions and answers only, as role and content", () => {
    const notice: ChatMessage = {
      id: "n1",
      role: "assistant",
      kind: "notice",
      content: "Stopped before any text arrived.",
    };
    expect(historyFor([question, notice, answer])).toEqual([
      { role: "user", content: question.content },
      { role: "assistant", content: answer.content },
    ]);
  });
});

describe("ask", () => {
  it("shows the retrieved notes at once, then streams the answer", async () => {
    let seenBody: { mode: string; messages: { role: string; content: string }[] } | undefined;
    const { store, storage } = storeWith(async (_url, init) => {
      seenBody = JSON.parse(String(init?.body));
      // Before the first byte: the question and a placeholder answer with its
      // locally retrieved notes are already in the thread.
      const pending = store.getState();
      expect(pending.status).toBe("retrieving");
      expect(pending.messages).toHaveLength(2);
      expect(pending.messages[1].sources).toContain("aura-ai");
      return okResponse(["He designed it ", "on FastAPI [1]."], {
        "X-Sources": encodeURIComponent(
          JSON.stringify([{ id: "aura-ai", title: "t", summary: "s" }]),
        ),
        "X-Retrieval": "aura-ai:14",
      });
    });

    await store.ask("How did he build Aura AI?");

    const state = store.getState();
    expect(seenBody?.mode).toBe("default");
    expect(seenBody?.messages.at(-1)).toEqual({
      role: "user",
      content: "How did he build Aura AI?",
    });
    expect(state.status).toBe("idle");
    expect(state.streamingId).toBeNull();
    expect(state.messages[1]).toMatchObject({
      kind: "answer",
      content: "He designed it on FastAPI [1].",
      provider: "groq:openai/gpt-oss-120b",
      sources: ["aura-ai"],
      scores: { "aura-ai": 14 },
    });
    expect(state.announcement).toContain("citing 1 of 1");
    expect(storage.data.get(STORAGE_KEY)).toContain("He designed it");
  });

  it("turns a rate-limit response into a notice that is not persisted", async () => {
    const { store, storage } = storeWith(async () =>
      new Response(JSON.stringify({ error: "Too many requests. Try again in 30s." }), {
        status: 429,
      }),
    );

    await store.ask("What is his current job?");

    const last = store.getState().messages.at(-1);
    expect(last).toMatchObject({
      kind: "notice",
      content: "Too many requests. Try again in 30s.",
    });
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });

  it("reports an unreachable server without mentioning a dev server", async () => {
    const { store } = storeWith(async () => {
      throw new TypeError("fetch failed");
    });

    await store.ask("What is his current job?");

    const last = store.getState().messages.at(-1);
    expect(last?.kind).toBe("notice");
    expect(last?.content).toContain("could not be reached");
    expect(last?.content).not.toMatch(/dev server|localhost/i);
  });

  it("treats an empty stream as a failure, not an empty answer", async () => {
    const { store } = storeWith(async () => okResponse([]));
    await store.ask("What is his current job?");
    expect(store.getState().messages.at(-1)).toMatchObject({ kind: "notice" });
  });

  it("ignores empty questions and a second question while busy", async () => {
    let calls = 0;
    const { store } = storeWith(async () => {
      calls += 1;
      void store.ask("second question while busy");
      return okResponse(["ok"]);
    });

    await store.ask("   ");
    expect(calls).toBe(0);
    await store.ask("What is his current job?");
    expect(calls).toBe(1);
    expect(store.getState().messages).toHaveLength(2);
  });

  it("does not send notices or stale turns as history", async () => {
    const bodies: { messages: { role: string; content: string }[] }[] = [];
    let first = true;
    const { store } = storeWith(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (first) {
        first = false;
        return new Response("{}", { status: 500 });
      }
      return okResponse(["Fine."]);
    });

    await store.ask("first question");
    await store.ask("second question");

    expect(bodies[1].messages).toEqual([
      { role: "user", content: "first question" },
      { role: "user", content: "second question" },
    ]);
  });
});

describe("reset and restore", () => {
  it("restores a saved thread once and clears it on reset", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, messages: [question, answer] }));
    const store = createChatStore({ storage: () => storage });

    store.restore();
    expect(store.getState().messages).toHaveLength(2);

    store.reset();
    expect(store.getState().messages).toHaveLength(0);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });
});

describe("review fixes", () => {
  it("drops a message's sources when any saved id is unknown, so numbers never shift", () => {
    const revived = reviveMessages({
      v: 2,
      messages: [question, { ...answer, sources: ["aura-ai", "not-a-note"] }],
    });
    expect(revived[1].sources).toBeUndefined();
  });

  it("never stores a job-description comparison, however short", () => {
    const jd: ChatMessage = {
      id: "q2",
      role: "user",
      kind: "question",
      content: `${jobDescriptionPrompt}Python, FastAPI.`,
    };
    expect(persistableMessages([question, answer, jd, { ...answer, id: "a2" }]).map((m) => m.id)).toEqual([
      "q1",
      "a1",
    ]);
  });

  it("clips earlier turns to the server's budget before sending", () => {
    const long: ChatMessage = { ...question, content: "x".repeat(3000) };
    const [sent] = historyFor([long, answer]);
    expect(sent.content.length).toBeLessThanOrEqual(600);
  });

  it("keeps a question asked while busy as the draft instead of dropping it", async () => {
    let release: (value: Response) => void = () => {};
    const { store } = storeWith(
      () => new Promise<Response>((resolve) => (release = resolve)),
    );
    const first = store.ask("What is his current job?");
    await store.ask("Which certifications does he hold?");
    expect(store.getState().draft).toBe("Which certifications does he hold?");
    release(okResponse(["Fine."]));
    await first;
  });

  it("retrieves locally over the same window the server sees", async () => {
    const { store } = storeWith(async () => okResponse(["ok"]));
    for (const q of [
      "How does the Hindi Semantic Search pipeline work, end to end?",
      "Tell me more",
      "and then?",
    ]) {
      await store.ask(q);
    }
    let local: string[] | undefined;
    const { store: probe } = storeWith(async () => {
      local = probe.getState().messages.at(-1)?.sources;
      return okResponse(["ok"]);
    });
    for (const m of store.getState().messages) {
      if (m.kind === "question") await probe.ask(m.content);
    }
    await probe.ask("go on");
    // Six turns of history leave only the last three questions, none of
    // which has keywords, so the local preview must agree: nothing pulled.
    expect(local).toEqual([]);
  });

  it("does not write a stop notice into a thread that was reset", async () => {
    const { store } = storeWith(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const pending = store.ask("What is his current job?");
    store.reset();
    await pending;
    expect(store.getState().messages).toEqual([]);
    expect(store.getState().announcement).toBe("");
  });

  it("announces an error once, through the always-mounted status line", async () => {
    const { store } = storeWith(async () => new Response("{}", { status: 500 }));
    await store.ask("What is his current job?");
    const notice = store.getState().messages.at(-1);
    expect(notice?.kind).toBe("notice");
    expect(store.getState().announcement).toBe(notice?.content);
  });
});

describe("client review fixes", () => {
  it("keeps focusRequest increasing across resets, so New chat always focuses", () => {
    const { store } = storeWith(async () => okResponse(["ok"]));
    const seen: number[] = [];
    store.requestFocus();
    seen.push(store.getState().focusRequest);
    store.reset();
    store.requestFocus();
    seen.push(store.getState().focusRequest);
    store.reset();
    store.requestFocus();
    seen.push(store.getState().focusRequest);
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    }
  });

  it("drops local sources when X-Sources names a note this build does not know", async () => {
    const { store } = storeWith(async () =>
      okResponse(["He designed it on FastAPI [1]."], {
        "X-Sources": encodeURIComponent(
          JSON.stringify([{ id: "note-from-a-newer-deploy", title: "t", summary: "s" }]),
        ),
        "X-Retrieval": "note-from-a-newer-deploy:14",
      }),
    );
    await store.ask("How did he build Aura AI?");
    const reply = store.getState().messages[1];
    expect(reply.sources).toEqual([]);
    expect(reply.scores).toBeUndefined();
    expect(reply.matched).toBeUndefined();
    expect(reply.expansions).toBeUndefined();
  });

  it("marks the notes as unknown, not unmatched, when X-Sources cannot be read", async () => {
    const { store } = storeWith(async () =>
      okResponse(["He designed it on FastAPI [1]."], {
        "X-Sources": encodeURIComponent(JSON.stringify([{ id: "note-from-a-newer-deploy" }])),
      }),
    );
    await store.ask("How did he build Aura AI?");
    expect(store.getState().messages[1].sourcesUnknown).toBe(true);
    expect(store.getState().announcement).not.toContain("citing 0 of 0");
  });

  it("does not mark the notes unknown when the server sent none at all", async () => {
    const { store } = storeWith(async () => okResponse(["ok [1]."]));
    await store.ask("How did he build Aura AI?");
    expect(store.getState().messages[1].sourcesUnknown).toBeUndefined();
  });

  it("never sends the cut-off notice back to the model as its own words", () => {
    const history = historyFor([
      question,
      { ...answer, content: `He designed it on FastAPI.${CUT_OFF_SUFFIX}` },
    ]);
    expect(history[1].content).toBe("He designed it on FastAPI.");
  });

  it("drops local sources when X-Sources is present but malformed", async () => {
    const { store } = storeWith(async () =>
      okResponse(["ok [1]."], { "X-Sources": "%E0%A4%A" }),
    );
    await store.ask("How did he build Aura AI?");
    expect(store.getState().messages[1].sources).toEqual([]);
  });

  it("keeps the local list when the server sends no X-Sources at all", async () => {
    const { store } = storeWith(async () => okResponse(["ok [1]."]));
    await store.ask("How did he build Aura AI?");
    expect(store.getState().messages[1].sources).toContain("aura-ai");
  });

  it("does not overwrite what the visitor is typing when asked while busy", async () => {
    let release: (value: Response) => void = () => {};
    const { store } = storeWith(
      () => new Promise<Response>((resolve) => (release = resolve)),
    );
    const first = store.ask("What is his current job?");
    store.setDraft("my own half-written question");
    const before = store.getState().focusRequest;
    await store.ask("Which certifications does he hold?");
    expect(store.getState().draft).toBe("my own half-written question");
    expect(store.getState().announcement).toBe("Wait for the current answer to finish.");
    expect(store.getState().focusRequest).toBe(before + 1);
    release(okResponse(["Fine."]));
    await first;
  });

  it("keeps the draft as-is when the busy ask is the draft itself", async () => {
    let release: (value: Response) => void = () => {};
    const { store } = storeWith(
      () => new Promise<Response>((resolve) => (release = resolve)),
    );
    const first = store.ask("What is his current job?");
    store.setDraft("  Which certifications does he hold?  ");
    await store.ask("Which certifications does he hold?");
    expect(store.getState().draft).toBe("Which certifications does he hold?");
    expect(store.getState().announcement).not.toBe("Wait for the current answer to finish.");
    release(okResponse(["Fine."]));
    await first;
  });
});
