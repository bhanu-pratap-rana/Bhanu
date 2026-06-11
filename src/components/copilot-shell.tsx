"use client";

import {
  ArrowUp,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileText,
  Layers3,
  Loader2,
  Mail,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  User,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  featuredQuestions,
  impactMetrics,
  knowledgeBase,
  portfolioProjects,
  profileSnapshot,
  techStack,
  experienceTimeline,
  type SourceRef,
} from "@/lib/knowledge";
import type { ChatMode } from "@/lib/rag";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  provider?: string;
};

const modeLabels: Record<ChatMode, string> = {
  default: "Copilot",
  recruiter: "Recruiter",
  architecture: "Architecture",
};

const starterMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello, I'm Bhanu Copilot. Ask me about Bhanu's projects, RAG systems, production AI work, architecture choices, research, or resume.",
  sources: knowledgeBase.slice(0, 3),
  provider: "profile-index",
};

const STORAGE_KEY = "bhanu-copilot-conversation";
const MAX_INPUT = 500;

const modeHints: Record<ChatMode, string> = {
  default: "General Q&A grounded in Bhanu's profile",
  recruiter: "Hiring signal, impact, and evidence — built for recruiters",
  architecture: "System design, data flow, and tech tradeoffs",
};

function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function formatContent(content: string, role: Message["role"]) {
  return content.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (role === "assistant" && bulletMatch) {
      return (
        <div key={index} className="mb-2 flex gap-2 last:mb-0">
          <span className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
          <p>{renderInlineMarkdown(bulletMatch[1])}</p>
        </div>
      );
    }

    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (role === "assistant" && numberedMatch) {
      return (
        <div
          key={index}
          className="mb-3 grid grid-cols-[1.75rem_1fr] gap-2 last:mb-0"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-100 font-mono text-xs text-stone-500">
            {numberedMatch[1]}
          </span>
          <p>{renderInlineMarkdown(numberedMatch[2])}</p>
        </div>
      );
    }

    return (
      <p key={index} className="mb-2 last:mb-0">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });
}

function readSourcesHeader(value: string | null): SourceRef[] | undefined {
  if (!value) return undefined;

  try {
    return JSON.parse(decodeURIComponent(value)) as SourceRef[];
  } catch {
    return undefined;
  }
}

export function CopilotShell() {
  const [messages, setMessages] = useState<Message[]>([starterMessage]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const latestSources = useMemo(() => {
    return [...messages].reverse().find((message) => message.sources?.length)
      ?.sources;
  }, [messages]);

  // Restore a prior conversation on mount (client-only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Hydrate from localStorage after mount. A lazy useState initializer
          // cannot read localStorage without causing an SSR hydration mismatch,
          // so post-mount setState is the correct pattern here.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setMessages(parsed);
        }
      }
    } catch {
      /* localStorage unavailable — start fresh */
    }
  }, []);

  // Persist the conversation so a refresh does not wipe it.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore quota / privacy-mode failures */
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantId: string | null = null;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      const provider = response.headers.get("x-provider") ?? undefined;
      const sources = readSourcesHeader(response.headers.get("x-sources"));

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        let message = errorText || "I could not answer that request.";
        try {
          const errorJson = JSON.parse(errorText) as { error?: string };
          message = errorJson.error ?? message;
        } catch {
          // Plain-text errors can be shown directly.
        }

        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: message,
            sources,
            provider,
          },
        ]);
        return;
      }

      assistantId = crypto.randomUUID();
      setStreamingId(assistantId);
      setMessages((current) => [
        ...current,
        {
          id: assistantId as string,
          role: "assistant",
          content: "",
          sources,
          provider,
        },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          const chunk = decoder.decode(result.value, { stream: true });
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${chunk}` }
                : message,
            ),
          );
        }
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  message.content.trim() ||
                  "I could not answer that request. Please try again.",
              }
            : message,
        ),
      );
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === "AbortError";
      if (aborted) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId && !message.content.trim()
              ? { ...message, content: "Generation stopped." }
              : message,
          ),
        );
      } else {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "I could not reach the copilot route. Check the local dev server and try again.",
          },
        ]);
      }
    } finally {
      abortRef.current = null;
      setStreamingId(null);
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function stopGenerating() {
    abortRef.current?.abort();
  }

  function startNewChat() {
    abortRef.current?.abort();
    setMessages([starterMessage]);
    setInput("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    inputRef.current?.focus();
  }

  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <main className="min-h-dvh bg-[#f4f3ef] text-stone-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-stone-500">
                Bhanu Copilot v1.0
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Groq live
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
              Applied AI Engineer
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
              GenAI, RAG, computer vision, FastAPI, and production AI automation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={profileSnapshot.resumePath}
              download
              className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
            >
              <Download size={16} aria-hidden="true" />
              Resume
            </a>
            <a
              href={profileSnapshot.github}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub profile"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
            >
              <GithubMark size={16} />
              GitHub
            </a>
            <a
              href={profileSnapshot.linkedin}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:bg-stone-50"
            >
              <BriefcaseBusiness size={16} aria-hidden="true" />
              LinkedIn
            </a>
            <a
              href={`mailto:${profileSnapshot.email}?subject=Interview%20opportunity%20for%20Bhanu`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800"
            >
              <Mail size={16} aria-hidden="true" />
              Get in touch
            </a>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 items-start gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex h-[calc(100dvh-154px)] min-h-[620px] flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_16px_50px_rgba(28,25,23,0.08)]">
            <div className="shrink-0 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stone-950 text-white">
                    <Bot size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Bhanu Copilot</p>
                    <p className="text-xs text-stone-500">{modeHints[mode]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md border border-stone-200 bg-stone-50 p-1">
                    {(Object.keys(modeLabels) as ChatMode[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={mode === item}
                        onClick={() => setMode(item)}
                        className={`h-8 rounded px-3 text-xs font-medium transition ${
                          mode === item
                            ? "bg-white text-stone-950 shadow-sm"
                            : "text-stone-500 hover:text-stone-900"
                        }`}
                      >
                        {modeLabels[item]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={startNewChat}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition hover:border-stone-400 hover:text-stone-900"
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    New chat
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  ["Retrieves", "profile evidence"],
                  ["Grounds", "every response"],
                  ["Shows", "source cards"],
                ].map(([verb, label]) => (
                  <div key={verb} className="rounded-md bg-stone-50 px-3 py-2">
                    <p className="text-xs text-stone-500">
                      <span className="font-semibold text-stone-800">{verb}</span>{" "}
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="chat-scroll min-h-0 flex-1 space-y-5 overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#fbfaf8_100%)] px-4 py-5 sm:px-6"
              role="log"
              aria-live="polite"
              aria-atomic="false"
            >
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-700">
                      <Sparkles size={16} aria-hidden="true" />
                    </span>
                  )}
                  <div
                    className={`max-w-[820px] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === "user"
                        ? "bg-stone-950 text-white"
                        : "border border-stone-200 bg-white text-stone-800"
                    }`}
                  >
                    <div className="space-y-1">
                      {formatContent(message.content, message.role)}
                      {streamingId === message.id && (
                        <span className="copilot-caret" aria-hidden="true" />
                      )}
                    </div>
                    {(message.provider || message.role === "assistant") && (
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                        {message.provider ? (
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone-500">
                            {message.provider}
                          </p>
                        ) : (
                          <span />
                        )}
                        {message.role === "assistant" &&
                          message.content.trim() &&
                          streamingId !== message.id && (
                            <button
                              type="button"
                              onClick={() =>
                                void copyMessage(message.id, message.content)
                              }
                              className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-stone-400 transition hover:text-stone-700"
                              aria-label="Copy answer"
                            >
                              {copiedId === message.id ? (
                                <>
                                  <Check size={12} aria-hidden="true" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={12} aria-hidden="true" /> Copy
                                </>
                              )}
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-950 text-white">
                      <User size={16} aria-hidden="true" />
                    </span>
                  )}
                </article>
              ))}
              {isLoading && !streamingId && (
                <div
                  role="status"
                  className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500 shadow-sm"
                >
                  <Loader2
                    className="animate-spin text-stone-900"
                    size={16}
                    aria-hidden="true"
                  />
                  Searching profile evidence and drafting an answer...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-stone-200 bg-white/95 p-4 backdrop-blur">
              <div className="chat-scroll mb-3 flex gap-2 overflow-x-auto pb-1">
                {featuredQuestions.slice(0, 5).map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void ask(question)}
                    className="shrink-0 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-white hover:text-stone-950"
                  >
                    {question}
                  </button>
                ))}
              </div>
              <form onSubmit={onSubmit} className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void ask(input);
                    }
                  }}
                  placeholder="Ask anything about Bhanu..."
                  aria-label="Ask anything about Bhanu"
                  maxLength={MAX_INPUT}
                  rows={2}
                  className="min-h-12 flex-1 resize-none rounded-md border border-stone-300 bg-white px-3 py-3 text-base leading-5 outline-none transition placeholder:text-stone-400 focus:border-stone-500 sm:text-sm"
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stopGenerating}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                    aria-label="Stop generating"
                  >
                    <Square size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-stone-950 text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                    aria-label="Send message"
                  >
                    <ArrowUp size={18} aria-hidden="true" />
                  </button>
                )}
              </form>
              <p className="mt-2 px-1 text-[11px] leading-4 text-stone-500">
                Answers are AI-generated from Bhanu&apos;s profile and may be
                imperfect.
              </p>
            </div>
          </div>

          <aside className="space-y-4 pr-1 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-154px)] lg:overflow-y-auto">
            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <BrainCircuit size={18} aria-hidden="true" />
                <h2 className="text-sm font-semibold">Signal Snapshot</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {impactMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-md bg-stone-50 p-3">
                    <p className="text-lg font-semibold">{metric.value}</p>
                    <p className="text-xs font-medium text-stone-600">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {techStack.slice(0, 12).map((tech) => (
                  <span
                    key={tech}
                    className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} aria-hidden="true" />
                <h2 className="text-sm font-semibold">Live AI Stack</h2>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ["Groq", "Server-side route handler, key never exposed"],
                  ["Hybrid RAG", "Full profile index plus retrieved evidence"],
                  ["Fallback ready", "Grounded local answer path for demos"],
                ].map(([name, detail]) => (
                  <div key={name} className="rounded-md border border-stone-200 p-3">
                    <p className="text-sm font-medium">{name}</p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Cpu size={18} aria-hidden="true" />
                <h2 className="text-sm font-semibold">Architecture Explorer</h2>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  "React Native / PWA",
                  "FastAPI route layer",
                  "PostgreSQL + Supabase",
                  "Vector retrieval",
                  "Redis + Celery workers",
                  "Groq / OpenAI generation",
                ].map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-stone-100 font-mono text-xs text-stone-500">
                      {index + 1}
                    </span>
                    <span className="text-sm text-stone-700">{step}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode("architecture");
                  void ask("Explain the Aura AI architecture.");
                }}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                <Cpu size={15} aria-hidden="true" />
                Explore Aura AI
              </button>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText size={18} aria-hidden="true" />
                <h2 className="text-sm font-semibold">Retrieved Evidence</h2>
              </div>
              <div className="mt-4 space-y-3">
                {(latestSources ?? knowledgeBase.slice(0, 3))
                  .slice(0, 4)
                  .map((source, index) => (
                    <div
                      key={source.id}
                      className="rounded-md border border-stone-200 p-3"
                    >
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-stone-100 font-mono text-[11px] text-stone-500">
                          {index + 1}
                        </span>
                        {source.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        {source.summary}
                      </p>
                    </div>
                  ))}
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Mail size={18} aria-hidden="true" />
                <h2 className="text-sm font-semibold">Contact</h2>
              </div>
              <div className="mt-4 space-y-2 text-sm text-stone-600">
                <a
                  href={`mailto:${profileSnapshot.email}`}
                  className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 transition hover:border-stone-400 hover:text-stone-950"
                >
                  <Mail size={15} aria-hidden="true" />
                  {profileSnapshot.email}
                </a>
                <a
                  href={profileSnapshot.github}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 transition hover:border-stone-400 hover:text-stone-950"
                >
                  <GithubMark size={15} />
                  GitHub
                </a>
                <a
                  href={profileSnapshot.leetcode}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 transition hover:border-stone-400 hover:text-stone-950"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                  LeetCode
                </a>
                <p className="flex items-center gap-2 px-1 pt-1">
                  <MapPin size={15} aria-hidden="true" />
                  {profileSnapshot.location}
                </p>
              </div>
            </section>
          </aside>
        </section>

        <section className="grid gap-4 border-t border-stone-200 py-6 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500">
                  Proof Library
                </p>
                <h2 className="mt-1 text-xl font-semibold">Featured AI Work</h2>
              </div>
              <button
                type="button"
                onClick={() => void ask("Show me Bhanu's strongest projects.")}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 transition hover:border-stone-400"
              >
                <Search size={15} aria-hidden="true" />
                Query projects
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {portfolioProjects.map((project) => (
                <article
                  key={project.name}
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                        {project.category}
                      </p>
                      <h3 className="mt-1 text-base font-semibold">
                        {project.name}
                      </h3>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">
                        {project.role}
                      </span>
                      {project.isPrivate && (
                        <span className="rounded-md border border-stone-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">
                          Private
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-600">
                    {project.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.stack.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-stone-100 pt-3">
                    {project.repoUrl && (
                      <a
                        href={project.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 transition hover:text-stone-950"
                      >
                        <GithubMark size={13} />
                        Code
                      </a>
                    )}
                    {project.demoUrl && (
                      <a
                        href={project.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 transition hover:text-stone-950"
                      >
                        <ExternalLink size={13} aria-hidden="true" />
                        Live demo
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void ask(`Tell me about ${project.name}.`)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 transition hover:text-stone-950"
                    >
                      <Sparkles size={13} aria-hidden="true" />
                      Ask copilot
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Layers3 size={18} aria-hidden="true" />
              <h2 className="text-sm font-semibold">Experience Timeline</h2>
            </div>
            <div className="mt-4 space-y-4">
              {experienceTimeline.map((item) => (
                <article key={`${item.org}-${item.role}`} className="relative pl-5">
                  <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-stone-950" />
                  <p className="text-sm font-semibold">{item.org}</p>
                  <p className="mt-1 text-xs font-medium text-stone-500">
                    {item.role} · {item.period}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {item.proof}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-8 md:grid-cols-3">
          {[
            {
              icon: Database,
              title: "Knowledge Base",
              body: "Resume/profile data is normalized into structured source cards for projects, roles, research, skills, and education.",
            },
            {
              icon: Search,
              title: "Retrieval Layer",
              body: "The API ranks relevant cards for every question and injects retrieved evidence beside the compact full-profile index.",
            },
            {
              icon: ExternalLink,
              title: "Recruiter Output",
              body: "Answers include concrete projects, technologies, metrics, and a visible evidence panel instead of generic portfolio copy.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
            >
              <item.icon size={18} aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{item.body}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
