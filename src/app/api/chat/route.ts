import { buildGroundingContext, localAnswer, toSourceRefs } from "@/lib/rag";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  classifyGroqFailure,
  createRetiredRegistry,
  groqErrorCode,
  modelCandidates,
  reasoningParams,
  type GroqFailure,
} from "@/lib/groq-models";
import { openModelStream, textStream } from "@/lib/groq-stream";
import {
  buildSystemPrompt,
  formatRetrievalScores,
  isSameOrigin,
  parseChatRequest,
  readJsonBody,
} from "@/lib/chat-request";

// Wire contract (the chat store depends on it):
//   POST { mode, messages } -> 200 text/plain stream
//   X-Provider   "groq:<model>" | "local-rag-fallback" | "local-rag-fallback:quota"
//   X-Sources    encodeURIComponent(JSON SourceRef[]), order = citation number
//   X-Retrieval  "id:score,..." and X-Retrieval-Note "reused-previous", when known
//   X-Warning    only on a fallback answer: why no model answered
//   errors       JSON { error } with 400, 403, 413, 429 (+ Retry-After) or 500

export const maxDuration = 30;

const SITE_BUCKET = "__site__";
const SITE_MAX_PER_MINUTE = 40;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// Ordered: an explicit GROQ_MODEL override first, then the maintained defaults.
const MODELS = modelCandidates(process.env.GROQ_MODEL);
// Per server instance, and it forgets: a stale GROQ_MODEL costs one failed
// round trip per ten minutes, and a misread error cannot bench a model for good.
const retiredModels = createRetiredRegistry();

// One model gets this long to send headers and its first text.
const ATTEMPT_TIMEOUT_MS = 12_000;
// All attempts together, so the offline answer still fits inside maxDuration.
const FIRST_TEXT_BUDGET_MS = 24_000;
// A stalled answer is ended cleanly before the platform kills the function.
const STREAM_STOP_MS = 27_000;

type ModelAttempt =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; outcome: GroqFailure | "aborted"; status: number };

function jsonError(
  status: number,
  error: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

function serverTiming(retrievalMs: number, name: string, modelMs: number) {
  return `retrieval;dur=${retrievalMs.toFixed(1)}, ${name};dur=${modelMs.toFixed(1)}`;
}

async function tryModel(
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  clientSignal: AbortSignal,
  timeoutMs: number,
  // Absolute, on the performance.now() clock: the time spent waiting for the
  // first text must count against it, or a slow start outlives maxDuration.
  streamDeadline: number,
): Promise<ModelAttempt> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  clientSignal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  let streaming = false;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        // Reasoning tokens share this budget, and Devanagari tokenises heavily.
        max_completion_tokens: 1200,
        stream: true,
        ...reasoningParams(model),
        messages,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const outcome = classifyGroqFailure(response.status, detail);
      // The error body can echo the request, so only its code is logged.
      console.error("groq request failed", {
        model,
        status: response.status,
        code: groqErrorCode(detail),
        outcome,
      });
      return { ok: false, outcome, status: response.status };
    }

    const opened = response.body
      ? await openModelStream(response.body, {
          isClientGone: () => clientSignal.aborted,
        })
      : ({ ok: false, reason: "empty" } as const);
    if (clientSignal.aborted) return { ok: false, outcome: "aborted", status: 0 };
    if (!opened.ok) {
      console.error("groq stream had no text", { model, reason: opened.reason });
      return { ok: false, outcome: "retry-next", status: response.status };
    }

    streaming = true;
    // Keeps the client-abort link; ends a stalled stream before maxDuration.
    const stop: unknown = setTimeout(
      abort,
      Math.max(0, streamDeadline - performance.now()),
    );
    (stop as { unref?: () => void }).unref?.();
    return { ok: true, stream: opened.stream };
  } catch (error) {
    if (clientSignal.aborted) return { ok: false, outcome: "aborted", status: 0 };
    console.error("groq request error", {
      model,
      error: controller.signal.aborted
        ? "timeout"
        : error instanceof Error
          ? error.name
          : "unknown",
    });
    return { ok: false, outcome: "retry-next", status: 0 };
  } finally {
    clearTimeout(timer);
    if (!streaming) clientSignal.removeEventListener("abort", abort);
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    if (!isSameOrigin(request)) {
      return jsonError(403, "This endpoint only answers its own site.");
    }

    const limit = rateLimit(clientKey(request));
    // One ceiling for the whole instance, so a handful of clients cannot use
    // up the model quota that every visitor shares.
    const siteLimit = limit.allowed
      ? rateLimit(SITE_BUCKET, Date.now(), SITE_MAX_PER_MINUTE)
      : limit;
    if (!siteLimit.allowed && limit.allowed) {
      return jsonError(
        429,
        `The copilot is busy right now. Try again in ${siteLimit.retryAfterSeconds}s.`,
        { "Retry-After": String(siteLimit.retryAfterSeconds) },
      );
    }
    if (!limit.allowed) {
      return jsonError(
        429,
        `Too many requests. Try again in ${limit.retryAfterSeconds}s.`,
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    const body = await readJsonBody(request);
    if (!body.ok) return jsonError(body.status, body.error);
    const parsed = parseChatRequest(body.value);
    if (!parsed.ok) return jsonError(parsed.status, parsed.error);
    const { mode, latest } = parsed;

    const retrievalStartedAt = performance.now();
    // Every user message in the window, oldest first: a follow-up with no
    // keywords of its own keeps the notes from the question before it.
    const grounding = buildGroundingContext(parsed.userMessages, mode);
    const retrievalMs = performance.now() - retrievalStartedAt;
    const { context, retrieved, retrieval } = grounding;
    const scores = formatRetrievalScores(
      retrieved.map((item) => item.id),
      retrieval.ranked,
    );

    const baseHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Sources": encodeURIComponent(JSON.stringify(toSourceRefs(retrieved))),
      ...(scores ? { "X-Retrieval": scores } : {}),
      ...(retrieval.reusedPrevious
        ? { "X-Retrieval-Note": "reused-previous" }
        : {}),
    };

    // A fallback answer is never labelled as a model.
    const fallback = (provider: string, warning: string, modelMs: number) =>
      new Response(textStream(localAnswer(latest, mode, retrieved)), {
        headers: {
          ...baseHeaders,
          "X-Provider": provider,
          "X-Warning": warning,
          "Server-Timing": serverTiming(retrievalMs, "attempts", modelMs),
        },
      });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return fallback("local-rag-fallback", "groq-not-configured", 0);

    const chatMessages: { role: string; content: string }[] = [
      { role: "system", content: buildSystemPrompt(mode, context) },
      ...parsed.messages,
    ];

    const modelsStartedAt = performance.now();
    const streamDeadline = startedAt + STREAM_STOP_MS;
    let failures = 0;
    let rateLimited = 0;
    let unreachable = 0;

    for (const model of MODELS) {
      if (retiredModels.has(model)) continue;
      const elapsed = performance.now() - startedAt;
      if (elapsed > FIRST_TEXT_BUDGET_MS - 1000) break;

      const attempt = await tryModel(
        model,
        apiKey,
        chatMessages,
        request.signal,
        Math.min(ATTEMPT_TIMEOUT_MS, FIRST_TEXT_BUDGET_MS - elapsed),
        streamDeadline,
      );

      if (attempt.ok) {
        return new Response(attempt.stream, {
          headers: {
            ...baseHeaders,
            "X-Provider": `groq:${model}`,
            "Server-Timing": serverTiming(
              retrievalMs,
              "ttft",
              performance.now() - modelsStartedAt,
            ),
          },
        });
      }
      // The visitor left; nobody is reading an answer.
      if (attempt.outcome === "aborted") return new Response(null, { status: 499 });
      if (attempt.outcome === "retired") {
        retiredModels.add(model);
        continue;
      }
      failures += 1;
      if (attempt.status === 429) rateLimited += 1;
      if (attempt.status === 0) unreachable += 1;
      if (attempt.outcome === "stop") break;
    }

    const modelMs = performance.now() - modelsStartedAt;
    if (failures > 0 && rateLimited === failures) {
      return fallback("local-rag-fallback:quota", "groq-quota", modelMs);
    }
    if (failures > 0 && unreachable === failures) {
      return fallback("local-rag-fallback", "groq-unreachable", modelMs);
    }
    return fallback(
      "local-rag-fallback",
      failures > 0 ? "groq-failed" : "groq-no-model",
      modelMs,
    );
  } catch (error) {
    // Name only: an error message can carry request text.
    console.error("chat route error", error instanceof Error ? error.name : "unknown");
    return jsonError(500, "Unable to process chat request.");
  }
}
