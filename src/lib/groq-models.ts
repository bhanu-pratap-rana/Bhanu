// Groq retires hosted models on short notice (Llama 4 Scout was shut down on
// 2026-07-17, which silently pushed every answer onto the offline fallback).
// The chat route therefore walks an ordered candidate list and moves on when a
// model is gone, rate-limited or silent, instead of trusting a single id.

export const DEFAULT_GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
] as const;

export function modelCandidates(configured: string | undefined): string[] {
  const preferred = configured?.trim();
  const ordered = preferred
    ? [preferred, ...DEFAULT_GROQ_MODELS]
    : [...DEFAULT_GROQ_MODELS];
  return [...new Set(ordered)];
}

export type GroqFailure = "retired" | "retry-next" | "stop";

type GroqError = { code: string; type: string; message: string };

function parseGroqError(body: string): GroqError {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  try {
    const parsed: unknown = JSON.parse(body);
    const error =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { error?: unknown }).error
        : undefined;
    if (typeof error === "object" && error !== null) {
      const fields = error as Record<string, unknown>;
      return {
        code: text(fields.code),
        type: text(fields.type),
        message: text(fields.message),
      };
    }
    return { code: "", type: "", message: "" };
  } catch {
    // Not JSON (a proxy's HTML page, a truncated body): only the text is left.
    return { code: "", type: "", message: body };
  }
}

// Safe to log: the provider's own error code, never the message, which can
// echo parts of the request.
export function groqErrorCode(body: string): string {
  const { code, type } = parseGroqError(body);
  return (code || type).replace(/[^\w.-]/g, "_").slice(0, 64);
}

const RETIRED_CODES = new Set(["model_not_found", "model_decommissioned"]);
const GONE_PHRASES = ["does not exist", "decommissioned", "no longer supported"];

// 498 is Groq's own "flex tier at capacity" status.
function isPerModelCapacity(status: number): boolean {
  return (
    status === 429 ||
    status === 413 ||
    status === 408 ||
    status === 498 ||
    status >= 500
  );
}

/**
 * What a non-OK Groq response means for the candidate walk:
 * - "retired": the model id is gone; skip it for a while.
 * - "retry-next": rate limit, request too large for this model's quota, or a
 *   provider fault. These are per model, so the next candidate may still work.
 * - "stop": the request or the key is wrong; every model would say the same.
 */
export function classifyGroqFailure(status: number, body: string): GroqFailure {
  const { code, message } = parseGroqError(body);
  if (RETIRED_CODES.has(code)) return "retired";
  if (isPerModelCapacity(status) || status < 400) return "retry-next";
  if (status === 401 || status === 403) return "stop";

  // Fallback for a body without a recognised code. Both halves are required:
  // "does not exist" alone also describes a wrong URL or a bad parameter.
  const text = message.toLowerCase();
  if (text.includes("model") && GONE_PHRASES.some((phrase) => text.includes(phrase))) {
    return "retired";
  }
  return "stop";
}

export function isModelUnavailable(status: number, body: string): boolean {
  return classifyGroqFailure(status, body) === "retired";
}

export type RetiredRegistry = {
  has(model: string, now?: number): boolean;
  add(model: string, now?: number): void;
};

// Retirement is remembered per server instance and only for a while, so one
// misread error body cannot take a working model out of rotation for good.
export function createRetiredRegistry(ttlMs = 10 * 60_000): RetiredRegistry {
  const retiredAt = new Map<string, number>();
  return {
    has(model, now = Date.now()) {
      const since = retiredAt.get(model);
      if (since === undefined) return false;
      if (now - since < ttlMs) return true;
      retiredAt.delete(model);
      return false;
    },
    add(model, now = Date.now()) {
      retiredAt.set(model, now);
    },
  };
}

// Reasoning models must not leak their scratchpad into the visible answer, and
// a portfolio Q&A does not need deep reasoning — keep it cheap and fast.
export function reasoningParams(model: string): Record<string, string | boolean> {
  if (model.startsWith("openai/gpt-oss")) {
    return { include_reasoning: false, reasoning_effort: "low" };
  }
  if (model.startsWith("qwen/")) {
    return { reasoning_format: "hidden" };
  }
  return {};
}

function prettyModelName(id: string): string {
  const name = id.split("/").pop() ?? id;
  if (name.startsWith("gpt-oss-")) {
    return `GPT-OSS ${name.slice("gpt-oss-".length).toUpperCase()}`;
  }
  return name
    .split("-")
    .map((part) =>
      /^\d+(\.\d+)?b$/i.test(part)
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

// Maps the X-Provider response header to wording a visitor can read.
export function modelLabel(provider: string | undefined): string {
  if (!provider) return "";
  if (provider.startsWith("groq:")) {
    return `${prettyModelName(provider.slice("groq:".length))} on Groq`;
  }
  if (provider === "guard") return "Declined: outside this copilot's scope";
  if (provider === "local-rag-fallback") return "Offline answer from the index";
  if (provider === "local-rag-fallback:quota") {
    return "Model quota used up for now — answer from the index";
  }
  return "";
}
