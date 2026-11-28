import { buildGroundingContext, localAnswer, toSourceRefs } from "@/lib/rag";
import { clientKey, rateLimit, trustsProxy } from "@/lib/rate-limit";
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
  ANSWER_SIGNATURE_SEPARATOR,
  SIGNATURE_HEADER,
  SIGNATURE_TRAILER,
  buildSystemPrompt,
  formatRetrievalScores,
  isSameOrigin,
  parseChatRequest,
  readJsonBody,
} from "@/lib/chat-request";
import {
  guardRefusal,
  isJobDescription,
  screenQuestion,
  signAnswer,
  signingKey,
  trustedAnswer,
} from "@/lib/chat-guard";
import { replyScript } from "@/lib/lang";

// Wire contract (the chat store depends on it):
//   POST { mode, messages, sign? } -> 200 text/plain stream
//     messages[].sig  an assistant turn's signature, as this route served it;
//                     an assistant turn without a valid one is dropped
//   X-Provider   "groq:<model>" | "local-rag-fallback" | "local-rag-fallback:quota"
//                | "guard" (refused before any model call)
//   X-Sources    encodeURIComponent(JSON SourceRef[]), order = citation number
//   X-Retrieval  "id:score,..." and X-Retrieval-Note "reused-previous", when known
//   X-Warning    only on a fallback answer: why no model answered
//   X-Answer-Signature  the answer's signature; "trailer" on a model stream
//                when `sign: true` was sent: the signature then follows the
//                text after U+001E
//   errors       JSON { error } with 400, 403, 405 (+ Allow), 413, 429
//                (+ Retry-After) or 500

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

type StreamOptions = {
  codeNotice: string;
  maxCitation: number;
  trailer?: (answer: string) => string;
};

async function tryModel(
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  clientSignal: AbortSignal,
  timeoutMs: number,
  // Absolute, on the performance.now() clock: the time spent waiting for the
  // first text must count against it, or a slow start outlives maxDuration.
  streamDeadline: number,
  streamOptions: StreamOptions,
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
          ...streamOptions,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    // Proxy headers count only where a proxy sets them (Vercel, TRUST_PROXY=1).
    const trustProxy = trustsProxy();
    if (!isSameOrigin(request, { trustProxy })) {
      return jsonError(403, "This endpoint only answers its own site.");
    }

    // Per client, before the body is read, so even malformed requests count.
    const limit = rateLimit(clientKey(request, { trustProxy }));
    if (!limit.allowed) {
      return jsonError(
        429,
        `Too many requests. Try again in ${limit.retryAfterSeconds}s.`,
        { "Retry-After": String(limit.retryAfterSeconds) },
      );
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      // A 413 leaves request bytes unread on the socket. Closing it keeps a
      // keep-alive client from sending its next request into that leftover.
      return jsonError(
        body.status,
        body.error,
        body.status === 413 ? { Connection: "close" } : {},
      );
    }
    const key = signingKey(process.env);
    const parsed = parseChatRequest(body.value, {
      verifyAnswer: (previousUser, answer, signature) =>
        trustedAnswer(key, previousUser, answer, signature),
      // Earlier turns are screened too, so an attack cannot be planted one
      // turn ahead of a harmless question. No retrieval count: the
      // general-knowledge rule stays off for history.
      keepUserTurn: (content) => !screenQuestion(content).blocked,
    });
    if (!parsed.ok) return jsonError(parsed.status, parsed.error);
    const { mode, latest } = parsed;
    const wantsTrailer = isRecord(body.value) && body.value.sign === true;
    const sign = (answer: string) => signAnswer(key, latest, answer);

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

    const plainHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };

    // Code, general tasks and injection markers get a fixed refusal: no model
    // call, and no share of the site-wide budget.
    const verdict = screenQuestion(latest, { retrievedCount: retrieved.length });
    if (verdict.blocked) {
      const refusal = guardRefusal(latest);
      console.info("chat guard refused", { reason: verdict.reason });
      return new Response(textStream(refusal), {
        headers: {
          ...plainHeaders,
          "X-Sources": encodeURIComponent("[]"),
          "X-Provider": "guard",
          [SIGNATURE_HEADER]: sign(refusal),
        },
      });
    }

    const baseHeaders: Record<string, string> = {
      ...plainHeaders,
      "X-Sources": encodeURIComponent(JSON.stringify(toSourceRefs(retrieved))),
      ...(scores ? { "X-Retrieval": scores } : {}),
      ...(retrieval.reusedPrevious
        ? { "X-Retrieval-Note": "reused-previous" }
        : {}),
    };

    // A fallback answer is never labelled as a model.
    const fallback = (provider: string, warning: string, modelMs: number) => {
      const answer = localAnswer(latest, mode, retrieved);
      return new Response(textStream(answer), {
        headers: {
          ...baseHeaders,
          "X-Provider": provider,
          "X-Warning": warning,
          "Server-Timing": serverTiming(retrievalMs, "attempts", modelMs),
          [SIGNATURE_HEADER]: sign(answer),
        },
      });
    };

    // One ceiling for the whole instance, so a handful of clients cannot use
    // up the model quota that every visitor shares. When it is full, visitors
    // get the matching notes instead of an error: a flood degrades the answer,
    // it does not take the copilot down.
    const siteLimit = rateLimit(SITE_BUCKET, Date.now(), SITE_MAX_PER_MINUTE);
    if (!siteLimit.allowed) return fallback("local-rag-fallback", "site-busy", 0);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return fallback("local-rag-fallback", "groq-not-configured", 0);

    const chatMessages: { role: string; content: string }[] = [
      {
        role: "system",
        content: buildSystemPrompt(mode, context, {
          replyIn: replyScript(latest),
          sources: retrieved.length,
          jobDescription: isJobDescription(latest),
        }),
      },
      ...parsed.messages,
    ];
    const streamOptions: StreamOptions = {
      // A code block the model starts anyway is cut and replaced by this.
      codeNotice: guardRefusal(latest),
      // Citations may only point at the notes sent, the X-Sources list.
      maxCitation: retrieved.length,
      ...(wantsTrailer
        ? { trailer: (answer: string) => `${ANSWER_SIGNATURE_SEPARATOR}${sign(answer)}` }
        : {}),
    };

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
        streamOptions,
      );

      if (attempt.ok) {
        return new Response(attempt.stream, {
          headers: {
            ...baseHeaders,
            "X-Provider": `groq:${model}`,
            ...(wantsTrailer ? { [SIGNATURE_HEADER]: SIGNATURE_TRAILER } : {}),
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

// Only POST is served. Explicit handlers make every other method a 405 with an
// Allow header and a JSON body, the same shape as the route's other errors.
function methodNotAllowed(): Response {
  return Response.json(
    { error: "Use POST." },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}

export function GET() {
  return methodNotAllowed();
}
export function HEAD() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
