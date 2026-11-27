import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROQ_MODELS,
  classifyGroqFailure,
  createRetiredRegistry,
  groqErrorCode,
  isModelUnavailable,
  modelCandidates,
  modelLabel,
  reasoningParams,
} from "./groq-models";

describe("modelCandidates", () => {
  it("returns the maintained defaults when no override is set", () => {
    expect(modelCandidates(undefined)).toEqual([...DEFAULT_GROQ_MODELS]);
    expect(modelCandidates("  ")).toEqual([...DEFAULT_GROQ_MODELS]);
  });

  it("tries a configured model first, then falls through to the defaults", () => {
    const candidates = modelCandidates("some/custom-model");
    expect(candidates[0]).toBe("some/custom-model");
    expect(candidates.slice(1)).toEqual([...DEFAULT_GROQ_MODELS]);
  });

  it("does not repeat a configured model that is already a default", () => {
    const candidates = modelCandidates(DEFAULT_GROQ_MODELS[1]);
    expect(candidates[0]).toBe(DEFAULT_GROQ_MODELS[1]);
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates).toHaveLength(DEFAULT_GROQ_MODELS.length);
  });
});

describe("isModelUnavailable", () => {
  it("detects a retired model from Groq's 404 body", () => {
    const body = JSON.stringify({
      error: {
        message:
          "The model `meta-llama/llama-4-scout-17b-16e-instruct` does not exist or you do not have access to it.",
        type: "invalid_request_error",
        code: "model_not_found",
      },
    });
    expect(isModelUnavailable(404, body)).toBe(true);
  });

  it("detects a decommissioned model reported as a 400", () => {
    const body = JSON.stringify({
      error: { message: "The model has been decommissioned.", code: "model_decommissioned" },
    });
    expect(isModelUnavailable(400, body)).toBe(true);
  });

  it("does not treat auth, rate-limit or server errors as a model problem", () => {
    expect(isModelUnavailable(401, '{"error":{"code":"invalid_api_key"}}')).toBe(false);
    expect(isModelUnavailable(429, '{"error":{"code":"rate_limit_exceeded"}}')).toBe(false);
    expect(isModelUnavailable(500, "")).toBe(false);
    expect(isModelUnavailable(400, '{"error":{"message":"messages is required"}}')).toBe(false);
  });
});

function errorBody(error: Record<string, unknown>): string {
  return JSON.stringify({ error });
}

describe("classifyGroqFailure", () => {
  it("marks a model retired from Groq's error code", () => {
    expect(
      classifyGroqFailure(404, errorBody({ code: "model_not_found", message: "x" })),
    ).toBe("retired");
    expect(
      classifyGroqFailure(400, errorBody({ code: "model_decommissioned" })),
    ).toBe("retired");
  });

  it("falls back to the message only when it is clearly about the model", () => {
    expect(
      classifyGroqFailure(
        404,
        errorBody({ message: "The model `foo/bar` does not exist or you do not have access to it." }),
      ),
    ).toBe("retired");
    expect(
      classifyGroqFailure(
        400,
        errorBody({ message: "The model `foo` has been decommissioned and is no longer supported." }),
      ),
    ).toBe("retired");
    expect(
      classifyGroqFailure(400, errorBody({ message: "This MODEL is no longer supported." })),
    ).toBe("retired");
  });

  it("does not retire a model over an unrelated 'does not exist' message", () => {
    expect(
      classifyGroqFailure(404, errorBody({ message: "The requested URL does not exist." })),
    ).toBe("stop");
    expect(
      classifyGroqFailure(
        400,
        errorBody({ message: "property 'reasoning_format' is no longer supported" }),
      ),
    ).toBe("stop");
    expect(
      classifyGroqFailure(400, errorBody({ message: "Unknown model parameter." })),
    ).toBe("stop");
  });

  it("treats rate limits and capacity as per-model: try the next one, never retire", () => {
    const rateLimited = errorBody({
      code: "rate_limit_exceeded",
      message: "Rate limit reached for model `openai/gpt-oss-120b` ... the model does not exist",
    });
    expect(classifyGroqFailure(429, rateLimited)).toBe("retry-next");
    expect(classifyGroqFailure(413, errorBody({ code: "rate_limit_exceeded" }))).toBe("retry-next");
    expect(classifyGroqFailure(408, "")).toBe("retry-next");
    expect(classifyGroqFailure(498, "")).toBe("retry-next");
    expect(classifyGroqFailure(500, "")).toBe("retry-next");
    expect(classifyGroqFailure(502, "<html>Bad Gateway</html>")).toBe("retry-next");
    expect(classifyGroqFailure(503, errorBody({ message: "model does not exist" }))).toBe(
      "retry-next",
    );
  });

  it("stops on auth errors and on any other client error", () => {
    expect(classifyGroqFailure(401, errorBody({ code: "invalid_api_key" }))).toBe("stop");
    expect(
      classifyGroqFailure(403, errorBody({ message: "The model does not exist for this org" })),
    ).toBe("stop");
    expect(classifyGroqFailure(400, errorBody({ message: "messages is required" }))).toBe("stop");
    expect(classifyGroqFailure(422, "")).toBe("stop");
    expect(classifyGroqFailure(404, "not json")).toBe("stop");
  });

  it("survives bodies that are not the documented shape", () => {
    expect(classifyGroqFailure(400, "")).toBe("stop");
    expect(classifyGroqFailure(400, "null")).toBe("stop");
    expect(classifyGroqFailure(400, "[]")).toBe("stop");
    expect(classifyGroqFailure(400, '{"error":"model_not_found"}')).toBe("stop");
    expect(classifyGroqFailure(404, '{"error":{"code":42,"message":7}}')).toBe("stop");
  });
});

describe("groqErrorCode", () => {
  it("returns the provider's error code and nothing else from the body", () => {
    expect(groqErrorCode(errorBody({ code: "rate_limit_exceeded", message: "secret" }))).toBe(
      "rate_limit_exceeded",
    );
    expect(groqErrorCode(errorBody({ type: "invalid_request_error" }))).toBe(
      "invalid_request_error",
    );
    expect(groqErrorCode("<html>")).toBe("");
    expect(groqErrorCode(errorBody({ code: "a b\nc".repeat(40) }))).toMatch(/^[\w.-]{0,64}$/);
  });
});

describe("createRetiredRegistry", () => {
  it("remembers a retired model until the TTL passes, then heals", () => {
    const registry = createRetiredRegistry(1000);
    expect(registry.has("a", 0)).toBe(false);
    registry.add("a", 0);
    expect(registry.has("a", 0)).toBe(true);
    expect(registry.has("a", 999)).toBe(true);
    expect(registry.has("b", 999)).toBe(false);
    expect(registry.has("a", 1000)).toBe(false);
    // Expired entries are forgotten, not just hidden.
    expect(registry.has("a", 500)).toBe(false);
  });

  it("restarts the clock when a model is reported again", () => {
    const registry = createRetiredRegistry(1000);
    registry.add("a", 0);
    registry.add("a", 800);
    expect(registry.has("a", 1500)).toBe(true);
    expect(registry.has("a", 1800)).toBe(false);
  });

  it("defaults to ten minutes", () => {
    const registry = createRetiredRegistry();
    registry.add("a", 0);
    expect(registry.has("a", 10 * 60_000 - 1)).toBe(true);
    expect(registry.has("a", 10 * 60_000)).toBe(false);
  });
});

describe("reasoningParams", () => {
  it("keeps GPT-OSS reasoning out of the answer and cheap", () => {
    expect(reasoningParams("openai/gpt-oss-120b")).toEqual({
      include_reasoning: false,
      reasoning_effort: "low",
    });
  });

  it("hides think tags for Qwen models", () => {
    expect(reasoningParams("qwen/qwen3.8-27b")).toEqual({
      reasoning_format: "hidden",
    });
  });

  it("sends nothing extra for models without reasoning controls", () => {
    expect(reasoningParams("llama-3.3-70b-versatile")).toEqual({});
  });
});

describe("modelLabel", () => {
  it("turns provider ids into something a visitor can read", () => {
    expect(modelLabel("groq:openai/gpt-oss-120b")).toBe("GPT-OSS 120B on Groq");
    expect(modelLabel("groq:qwen/qwen3.8-27b")).toBe("Qwen3.8 27B on Groq");
    expect(modelLabel("local-rag-fallback")).toBe("Offline answer from the index");
    expect(modelLabel("local-rag-fallback:quota")).toBe(
      "Model quota used up for now — answer from the index",
    );
    expect(modelLabel("something-else")).toBe("");
    expect(modelLabel(undefined)).toBe("");
  });
});
