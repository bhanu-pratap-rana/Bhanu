// The copilot's state lives in one small external store rather than React
// context state, so that (a) any button on the page can ask a question without
// re-rendering on every streamed token, and (b) the reducer logic is testable
// without a DOM. Components read slices through useSyncExternalStore.

import { countCitations, stripCitations, tidySpaces } from "../components/markdown";
import {
  ANSWER_SIGNATURE_SEPARATOR,
  ASSISTANT_SEND_CHARS,
  CUT_OFF_SUFFIX,
  EARLIER_USER_CHARS,
  EARLIER_USER_SEND_CHARS,
  SIGNATURE_HEADER,
  SIGNATURE_PATTERN,
  SIGNATURE_TRAILER,
  SIGNED_ANSWER_CHARS,
  SIGNED_USER_CHARS,
  parseChatRequest,
  signedPrefix,
} from "./chat-request";
import {
  getKnowledgeItem,
  jobDescriptionPrompt,
  knowledgeBase,
  profile,
} from "./knowledge";
import { retrieve, type ChatMode, type Expansion } from "./rag";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  /** `notice` is site copy (errors, stops). It is never sent to the model. */
  kind: "question" | "answer" | "notice";
  content: string;
  /** Ids of the notes given to the model, in citation order. */
  sources?: string[];
  scores?: Record<string, number>;
  matched?: Record<string, string[]>;
  expansions?: Expansion[];
  reusedPrevious?: boolean;
  /** The server named notes this build of the page does not know. */
  sourcesUnknown?: boolean;
  /** Raw X-Provider value; absent until the server has answered. */
  provider?: string;
  stopped?: boolean;
  firstTextMs?: number;
  totalMs?: number;
  /**
   * The server's signature over this answer and its question. Sent back with
   * the history; the server drops an earlier answer that has none.
   */
  sig?: string;
};

const SIGNATURE = SIGNATURE_PATTERN;

function validSig(value: unknown): string | undefined {
  return typeof value === "string" && SIGNATURE.test(value) ? value : undefined;
}

export type ChatStatus = "idle" | "retrieving" | "streaming";

export type ChatState = {
  messages: ChatMessage[];
  status: ChatStatus;
  streamingId: string | null;
  draft: string;
  /** A starter question being pointed at; previews its retrieval. */
  preview: string | null;
  /**
   * Whether the copilot is open: the modal dialog on phones, the floating
   * window (with the core docked into it) on laptops, per DESKTOP_QUERY in
   * copilot-host.ts. Kept in memory only, never persisted.
   */
  open: boolean;
  /** Incremented to ask the composer to take focus. */
  focusRequest: number;
  /** Text for the single polite live region. */
  announcement: string;
};

export const EMPTY_CHAT_STATE: ChatState = {
  messages: [],
  status: "idle",
  streamingId: null,
  draft: "",
  preview: null,
  open: false,
  focusRequest: 0,
  announcement: "",
};

export const STORAGE_KEY = "bhanu-copilot:v2";
/** Longest question a shared `?q=` link carries. */
export const DEEP_LINK_MAX = 300;
export const NOTE_COUNT = knowledgeBase.length;
/** Longer questions (a pasted job description) are never written to storage. */
const PERSIST_MAX_CHARS = 1000;
const HISTORY_LIMIT = 6;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ChatStoreDeps = {
  fetch?: typeof fetch;
  storage?: () => StorageLike | undefined;
  now?: () => number;
  schedule?: (flush: () => void) => void;
  newId?: () => string;
};

const KINDS = new Set(["question", "answer", "notice"]);

/** Accepts only well-formed messages; drops anything else silently. */
export function reviveMessages(raw: unknown): ChatMessage[] {
  if (!raw || typeof raw !== "object") return [];
  const data = raw as { v?: unknown; messages?: unknown };
  if (data.v !== 2 || !Array.isArray(data.messages)) return [];

  const revived: ChatMessage[] = [];
  for (const entry of data.messages) {
    if (!entry || typeof entry !== "object") continue;
    const message = entry as Partial<ChatMessage>;
    if (
      typeof message.id !== "string" ||
      typeof message.content !== "string" ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.kind !== "string" ||
      !KINDS.has(message.kind) ||
      message.kind === "notice"
    ) {
      continue;
    }
    revived.push({
      id: message.id,
      role: message.role,
      kind: message.kind,
      content: message.content,
      sources: knownIds(message.sources),
      provider:
        typeof message.provider === "string" ? message.provider : undefined,
      stopped: message.stopped === true ? true : undefined,
      sourcesUnknown: message.sourcesUnknown === true ? true : undefined,
      sig: message.role === "assistant" ? validSig(message.sig) : undefined,
    });
  }
  // A thread must start with a question and never end on one.
  while (revived.length && revived[0].role !== "user") revived.shift();
  while (revived.length && revived[revived.length - 1].role === "user") {
    revived.pop();
  }
  return revived;
}

/**
 * Citations point at sources by position, so a list with an unknown id (from
 * an older or newer deploy) is dropped whole rather than compacted: shifting
 * the positions would point every later citation at the wrong note.
 */
function knownIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter((id): id is string => typeof id === "string");
  if (ids.length !== value.length) return undefined;
  return ids.every((id) => getKnowledgeItem(id)) ? ids : undefined;
}

const JD_PREFIX = jobDescriptionPrompt.trimEnd();

/** What is safe to keep: finished answers, and nothing after a long paste. */
export function persistableMessages(messages: ChatMessage[]): ChatMessage[] {
  const kept: ChatMessage[] = [];
  for (const message of messages) {
    if (message.kind === "notice") continue;
    if (
      message.role === "user" &&
      (message.content.length > PERSIST_MAX_CHARS ||
        message.content.startsWith(JD_PREFIX))
    ) {
      break;
    }
    kept.push(message);
  }
  while (kept.length && kept[kept.length - 1].role === "user") kept.pop();
  return kept;
}

/** The turns the model should see: real questions and real answers only. */
export function historyFor(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.kind !== "notice" && message.content.trim())
    .slice(-HISTORY_LIMIT)
    .map(({ role, content, sig }) => {
      // The cut-off notice is site copy, not the model's words, so it never
      // goes back to the model.
      const text =
        role === "assistant" && content.endsWith(CUT_OFF_SUFFIX)
          ? content.slice(0, -CUT_OFF_SUFFIX.length)
          : content;
      return {
        role,
        // Enough to carry the part the signature covers (a count of non-space
        // characters), capped so long turns never push the request over its
        // size limit. The server clips again before the model sees it.
        content:
          role === "user"
            ? text.slice(
                0,
                Math.max(
                  EARLIER_USER_CHARS,
                  signedPrefix(text, SIGNED_USER_CHARS, EARLIER_USER_SEND_CHARS).length,
                ),
              )
            : signedPrefix(text, SIGNED_ANSWER_CHARS, ASSISTANT_SEND_CHARS),
        ...(role === "assistant" && sig ? { sig } : {}),
      };
    });
}

/** The answer text and, after the separator, a streamed signature. */
function splitTrailer(buffer: string, trailer: boolean): { text: string; sig?: string } {
  if (!trailer) return { text: buffer };
  const cut = buffer.indexOf(ANSWER_SIGNATURE_SEPARATOR);
  if (cut < 0) return { text: buffer };
  return {
    text: buffer.slice(0, cut),
    sig: validSig(buffer.slice(cut + ANSWER_SIGNATURE_SEPARATOR.length).trim()),
  };
}

/**
 * The user messages the server will retrieve over for this request: the same
 * six-turn window, clipped the same way. The live preview uses this too, so
 * what the index shows is what the model is given.
 */
export function windowedQuestions(
  messages: ChatMessage[],
  next: string,
): string[] {
  const parsed = parseChatRequest({
    messages: [...historyFor(messages), { role: "user", content: next }],
  });
  return parsed.ok ? parsed.userMessages : [next];
}

/**
 * `absent` means the server said nothing, so the local list stands. `unusable`
 * means the server did say which notes the model saw but this build cannot
 * name them (a newer deploy, or a mangled header): the local list is then known
 * to be wrong, and keeping it would point citations at the wrong notes.
 */
type ServerSources =
  | { kind: "absent" }
  | { kind: "unusable" }
  | { kind: "known"; ids: string[] };

function parseSourceIds(header: string | null): ServerSources {
  if (header === null) return { kind: "absent" };
  try {
    const parsed = JSON.parse(decodeURIComponent(header)) as { id?: unknown }[];
    if (!Array.isArray(parsed)) return { kind: "unusable" };
    const ids = knownIds(parsed.map((entry) => entry?.id));
    return ids ? { kind: "known", ids } : { kind: "unusable" };
  } catch {
    return { kind: "unusable" };
  }
}

function parseScores(header: string | null): Record<string, number> | undefined {
  if (!header) return undefined;
  const scores: Record<string, number> = {};
  for (const pair of header.split(",")) {
    const cut = pair.lastIndexOf(":");
    if (cut <= 0) continue;
    const score = Number(pair.slice(cut + 1));
    if (Number.isFinite(score)) scores[pair.slice(0, cut).trim()] = score;
  }
  return Object.keys(scores).length ? scores : undefined;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error) return parsed.error;
  } catch {
    /* not JSON */
  }
  if (response.status === 429) {
    return "Too many questions in a short time. Wait a minute and ask again.";
  }
  return `The copilot could not answer that. Try again, or email ${profile.email}.`;
}

export function createChatStore(deps: ChatStoreDeps = {}) {
  const now = deps.now ?? (() => Date.now());
  const newId =
    deps.newId ??
    (() =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `m-${now()}-${Math.random().toString(36).slice(2)}`);
  const schedule =
    deps.schedule ??
    ((flush: () => void) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(flush);
      } else {
        flush();
      }
    });
  const storage =
    deps.storage ??
    (() => {
      try {
        return typeof localStorage === "undefined" ? undefined : localStorage;
      } catch {
        return undefined;
      }
    });

  let state: ChatState = EMPTY_CHAT_STATE;
  const listeners = new Set<() => void>();
  let controller: AbortController | null = null;
  let restored = false;
  // Bumped by every ask and every reset: a run that is no longer current must
  // not write into the thread that replaced it.
  let run = 0;

  function set(patch: Partial<ChatState>) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  }

  function patchMessage(id: string, patch: Partial<ChatMessage>) {
    set({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    });
  }

  function persist() {
    const store = storage();
    if (!store) return;
    try {
      const messages = persistableMessages(state.messages);
      if (messages.length === 0) store.removeItem(STORAGE_KEY);
      else store.setItem(STORAGE_KEY, JSON.stringify({ v: 2, messages }));
    } catch {
      /* quota or privacy mode: the thread simply is not kept */
    }
  }

  /** Reads a saved thread once, after hydration, so markup always matches. */
  function restore() {
    if (restored) return;
    restored = true;
    const store = storage();
    if (!store) return;
    try {
      const saved = store.getItem(STORAGE_KEY);
      if (!saved) return;
      const messages = reviveMessages(JSON.parse(saved));
      if (messages.length && state.messages.length === 0) set({ messages });
    } catch {
      /* unreadable: start fresh */
    }
  }

  function fail(assistantId: string, content: string) {
    set({
      messages: state.messages.map((message) =>
        message.id === assistantId
          ? { id: message.id, role: "assistant", kind: "notice", content }
          : message,
      ),
      // The single status line is the only place an error is announced: it
      // is always mounted, so the text is heard even when the phone dialog is
      // closed, and the notice itself is not a second live region.
      announcement: content,
    });
  }

  async function ask(question: string, options: { mode?: ChatMode } = {}) {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (state.status !== "idle") {
      const typed = state.draft.trim();
      if (typed && typed !== trimmed) {
        // The visitor is writing their own question; a starter or follow-up
        // click must not wipe it. Say why nothing was sent instead.
        set({
          announcement: "Wait for the current answer to finish.",
          focusRequest: state.focusRequest + 1,
        });
        return;
      }
      // Keep it for the visitor to send once the current answer is done.
      set({ draft: trimmed, focusRequest: state.focusRequest + 1 });
      return;
    }
    const mine = ++run;

    const history = [
      ...historyFor(state.messages),
      { role: "user" as const, content: trimmed },
    ].slice(-HISTORY_LIMIT);

    // Retrieval runs here too, with the same function the server uses over
    // the same window, so the notes appear at once instead of waiting for the
    // first byte.
    const local = retrieve({
      userMessages: windowedQuestions(state.messages, trimmed),
    });
    const assistantId = newId();
    const startedAt = now();

    set({
      messages: [
        ...state.messages,
        { id: newId(), role: "user", kind: "question", content: trimmed },
        {
          id: assistantId,
          role: "assistant",
          kind: "answer",
          content: "",
          sources: local.ranked.map(({ item }) => item.id),
          scores: Object.fromEntries(
            local.ranked.map(({ item, score }) => [item.id, score]),
          ),
          matched: Object.fromEntries(
            local.ranked.map(({ item, matched }) => [item.id, matched]),
          ),
          expansions: local.expansions,
          reusedPrevious: local.reusedPrevious,
        },
      ],
      status: "retrieving",
      streamingId: assistantId,
      draft: "",
      preview: null,
      announcement:
        local.ranked.length > 0
          ? `Found ${local.ranked.length} of ${NOTE_COUNT} notes.`
          : "No note matches those keywords.",
    });

    controller = new AbortController();
    let buffer = "";
    // The server announced that a signature follows the streamed text.
    let trailer = false;
    const visible = () => splitTrailer(buffer, trailer).text;
    let flushQueued = false;
    const flush = () => {
      flushQueued = false;
      if (state.streamingId !== assistantId) return;
      patchMessage(assistantId, { content: tidySpaces(visible()) });
    };

    try {
      const response = await (deps.fetch ?? fetch)("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: options.mode ?? "default",
          messages: history,
          // Ask for a signature after the streamed text (an older server ignores it).
          sign: true,
        }),
      });

      if (!response.ok || !response.body) {
        const error = await readError(response);
        if (mine === run) fail(assistantId, error);
        return;
      }

      const sigHeader = response.headers.get(SIGNATURE_HEADER);
      trailer = sigHeader === SIGNATURE_TRAILER;
      const headerSig = trailer ? undefined : validSig(sigHeader);

      // The server's list is the truth about what the model was given.
      const serverSources = parseSourceIds(response.headers.get("x-sources"));
      const serverScores = parseScores(response.headers.get("x-retrieval"));
      const localIds = local.ranked.map(({ item }) => item.id).join(",");
      const differs =
        serverSources.kind === "known" && serverSources.ids.join(",") !== localIds;
      patchMessage(assistantId, {
        provider: response.headers.get("x-provider") ?? undefined,
        ...(serverSources.kind === "known" ? { sources: serverSources.ids } : {}),
        ...(serverScores ? { scores: serverScores } : {}),
        reusedPrevious:
          response.headers.get("x-retrieval-note") === "reused-previous",
        // Local match details describe a different list; do not show them.
        ...(differs ? { matched: undefined, expansions: undefined } : {}),
        // No list at all beats a wrong one: citations then render as plain
        // text instead of opening a note the model never saw.
        ...(serverSources.kind === "unusable"
          ? {
              sources: [],
              sourcesUnknown: true,
              scores: undefined,
              matched: undefined,
              expansions: undefined,
            }
          : {}),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let first = true;

      for (;;) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          if (first && visible().trim()) {
            first = false;
            set({ status: "streaming" });
            patchMessage(assistantId, { firstTextMs: now() - startedAt });
          }
          if (!flushQueued) {
            flushQueued = true;
            schedule(flush);
          }
        }
        if (done) break;
      }
      buffer += decoder.decode();

      const finished = splitTrailer(buffer, trailer);
      const content = tidySpaces(finished.text.trim());
      if (!content) {
        fail(assistantId, "The model returned no text. Ask again.");
        return;
      }
      const reply = state.messages.find((message) => message.id === assistantId);
      const sourceCount = reply?.sources?.length ?? 0;
      const sig = finished.sig ?? headerSig;
      patchMessage(assistantId, {
        content,
        totalMs: now() - startedAt,
        ...(sig ? { sig } : {}),
      });
      const { cited } = countCitations(content, sourceCount);
      const text = stripCitations(content).slice(0, 700);
      set({
        announcement: reply?.sourcesUnknown
          ? `Answer: ${text}`
          : `Answer, citing ${cited.length} of ${sourceCount} notes: ${text}`,
      });
    } catch (error) {
      if (mine !== run) return;
      const aborted =
        typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError";
      if (aborted && visible().trim()) {
        // A stopped answer has no signature, so it is not sent back as history.
        patchMessage(assistantId, { content: tidySpaces(visible().trim()), stopped: true });
        set({ announcement: "Stopped." });
      } else if (aborted) {
        fail(assistantId, "Stopped before any text arrived.");
      } else {
        fail(
          assistantId,
          `The copilot could not be reached. Check your connection and ask again, or email ${profile.email}.`,
        );
      }
    } finally {
      if (mine === run) {
        controller = null;
        set({ status: "idle", streamingId: null });
        persist();
      }
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    restore,
    ask,
    stop() {
      controller?.abort();
    },
    reset() {
      run += 1;
      controller?.abort();
      controller = null;
      // focusRequest only ever grows: the composer and the dialog host act
      // on a change, so winding it back could make the next request equal a
      // value they have already handled, and New chat would not focus.
      set({
        ...EMPTY_CHAT_STATE,
        open: state.open,
        focusRequest: state.focusRequest,
      });
      try {
        storage()?.removeItem(STORAGE_KEY);
      } catch {
        /* nothing to clear */
      }
    },
    setDraft(draft: string) {
      if (draft !== state.draft) set({ draft });
    },
    setPreview(preview: string | null) {
      if (preview !== state.preview) set({ preview });
    },
    /**
     * Opens the copilot (phone dialog or laptop window). `focus` also asks
     * for the field; the phone dialog honours that only with a fine pointer
     * (dialogFocusOnOpen in copilot-host.ts).
     */
    open(options: { focus?: boolean } = {}) {
      set({
        open: true,
        focusRequest: options.focus
          ? state.focusRequest + 1
          : state.focusRequest,
      });
    },
    close() {
      if (state.open) set({ open: false });
    },
    requestFocus() {
      set({ focusRequest: state.focusRequest + 1 });
    },
  };
}

export type ChatStore = ReturnType<typeof createChatStore>;
