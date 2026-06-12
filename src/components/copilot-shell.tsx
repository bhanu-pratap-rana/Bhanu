"use client";

import {
  ArrowUp,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  User,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { GithubMark } from "@/components/github-mark";
import { MessageBody } from "@/components/markdown";
import { useChat } from "@/components/copilot/useChat";
import { ProofLibrary } from "@/components/sections/ProofLibrary";
import { ExperienceTimeline } from "@/components/sections/ExperienceTimeline";
import { HowItWorks } from "@/components/sections/HowItWorks";
import {
  featuredQuestions,
  impactMetrics,
  knowledgeBase,
  profileSnapshot,
  techStack,
  architectures,
} from "@/lib/knowledge";
import type { ChatMode } from "@/lib/rag";

const modeLabels: Record<ChatMode, string> = {
  default: "Copilot",
  recruiter: "Recruiter",
  architecture: "Architecture",
};

const MAX_INPUT = 500;

const modeHints: Record<ChatMode, string> = {
  default: "General Q&A grounded in Bhanu's profile",
  recruiter: "Hiring signal, impact, and evidence — built for recruiters",
  architecture: "System design, data flow, and tech tradeoffs",
};

export function CopilotShell() {
  const {
    messages,
    input,
    setInput,
    mode,
    setMode,
    isLoading,
    streamingId,
    copiedId,
    latestSources,
    inputRef,
    messagesEndRef,
    ask,
    stopGenerating,
    startNewChat,
    copyMessage,
  } = useChat();

  const [archKey, setArchKey] = useState(architectures[0].key);
  const activeArch =
    architectures.find((view) => view.key === archKey) ?? architectures[0];
  const [showJd, setShowJd] = useState(false);
  const [jd, setJd] = useState("");

  function submitJobDescription() {
    const trimmed = jd.trim();
    if (!trimmed) return;
    setShowJd(false);
    setJd("");
    setMode("recruiter");
    void ask(
      `Here is a job description. Assess how well Bhanu fits it: list strong matches (cite his real projects as evidence), partial matches, and honest gaps.\n\nJOB DESCRIPTION:\n${trimmed}`,
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="min-h-dvh bg-[#f4f3ef] text-stone-950 outline-none"
    >
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

        <section
          aria-label="Summary"
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-stone-200 py-3"
        >
          <p className="max-w-xl text-sm leading-6 text-stone-700">
            Applied AI Engineer shipping production RAG, computer vision, and
            FastAPI systems. Ask the copilot anything — or skim the proof below.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {impactMetrics.slice(0, 4).map((metric) => (
              <div key={metric.label} className="text-center">
                <p className="text-base font-semibold text-stone-950">
                  {metric.value}
                </p>
                <p className="text-[11px] leading-tight text-stone-600">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </section>

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
              <p className="mt-3 text-xs text-stone-600">{modeHints[mode]}</p>
              {mode === "recruiter" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    ["Why hire Bhanu?", "Why should we hire Bhanu? Be specific and evidence-based."],
                    ["Strongest projects", "Show me Bhanu's strongest projects with the tech and impact."],
                    ["Production experience", "What production AI systems has Bhanu shipped?"],
                    ["Tech skills", "Summarize Bhanu's technical skills by category."],
                  ].map(([label, prompt]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => void ask(prompt)}
                      className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
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
                  className={`message-enter flex gap-3 ${
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
                      <MessageBody
                        content={message.content}
                        role={message.role}
                      />
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
                              className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-stone-600 transition hover:text-stone-900"
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
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("recruiter");
                    void ask(
                      "Generate 10 targeted interview questions a hiring manager could ask Bhanu, grounded in his real projects and tech.",
                    );
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white transition hover:bg-stone-800"
                >
                  <Sparkles size={15} aria-hidden="true" />
                  Generate interview questions
                </button>
                <button
                  type="button"
                  onClick={() => setShowJd((open) => !open)}
                  aria-expanded={showJd}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 transition hover:border-stone-400"
                >
                  <FileText size={15} aria-hidden="true" />
                  Match a job description
                </button>
              </div>
              {showJd && (
                <div className="mb-3 rounded-md border border-stone-300 bg-white p-3">
                  <label htmlFor="jd" className="sr-only">
                    Paste a job description
                  </label>
                  <textarea
                    id="jd"
                    value={jd}
                    onChange={(event) => setJd(event.target.value)}
                    maxLength={6000}
                    rows={4}
                    placeholder="Paste a job description — the copilot maps Bhanu's fit (strong matches, partials, honest gaps)..."
                    className="w-full resize-none rounded-md border border-stone-200 bg-white p-2 text-sm outline-none transition placeholder:text-stone-500 focus:border-stone-500"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowJd(false);
                        setJd("");
                      }}
                      className="h-8 rounded-md px-3 text-xs font-medium text-stone-600 transition hover:text-stone-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitJobDescription}
                      disabled={!jd.trim() || isLoading}
                      className="inline-flex h-8 items-center rounded-md bg-stone-950 px-3 text-xs font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                    >
                      Analyze fit
                    </button>
                  </div>
                </div>
              )}
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
                  className="min-h-12 flex-1 resize-none rounded-md border border-stone-300 bg-white px-3 py-3 text-base leading-5 outline-none transition placeholder:text-stone-500 focus:border-stone-500 sm:text-sm"
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
                  ["Groq LLaMA 3.3 70B", "Streamed server-side via a route handler"],
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
              <div className="mt-3 flex flex-wrap gap-1.5">
                {architectures.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    aria-pressed={archKey === view.key}
                    onClick={() => setArchKey(view.key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      archKey === view.key
                        ? "bg-stone-950 text-white"
                        : "border border-stone-200 text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2.5">
                {activeArch.steps.map((step, index) => (
                  <div key={step.node} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-stone-100 font-mono text-xs text-stone-500">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-stone-800">
                        {step.node}
                      </p>
                      <p className="text-xs leading-5 text-stone-600">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode("architecture");
                  void ask(`Explain the ${activeArch.label} architecture.`);
                }}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                <Cpu size={15} aria-hidden="true" />
                Explain {activeArch.label}
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
          <ProofLibrary onAsk={ask} />
          <ExperienceTimeline />
        </section>

        <HowItWorks />
      </div>
    </main>
  );
}
