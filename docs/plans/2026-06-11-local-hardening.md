# Bhanu Copilot — Local Hardening & Vision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every issue from the two audits that can be resolved locally (no deploy/DB/external accounts), in dependency order, leaving the repo in a verified, ship-ready state.

**Architecture:** Keep the proven `knowledge.ts → rag.ts → route.ts` logic layer. Decompose the 913-line `copilot-shell.tsx` monolith into focused components + a `useChat` hook, move static sections to Server Components, add design primitives + tokens, and close the verified a11y/security/credibility gaps.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Vitest, Groq.

**Verification gate (run after every task):**
```bash
npm run lint && npm test && npm run build
```
All three must pass. UI tasks are additionally verified by `npm run dev` + visual check.

**Out of scope (manual / later phase):** Vercel deploy, `NEXT_PUBLIC_SITE_URL` real value, Vercel Analytics, Upstash rate limiting, Sentry, project screenshots, Groq key rotation, optional pgvector/DB.

---

## File Structure (target after Phase 3)

```
src/
├── app/
│   ├── layout.tsx              # + skip link
│   ├── page.tsx                # composes server + client sections
│   ├── error.tsx               # NEW route error boundary (client)
│   ├── globals.css             # + design tokens
│   ├── robots.ts / sitemap.ts / opengraph-image.tsx   # (done)
│   └── api/chat/route.ts       # unchanged logic
├── components/
│   ├── copilot/
│   │   ├── ChatPanel.tsx       # NEW client — chat UI (was top of monolith)
│   │   ├── SidePanels.tsx      # NEW client — signal/stack/arch/evidence/contact
│   │   ├── Message.tsx         # NEW client — one bubble + copy + caret
│   │   └── useChat.ts          # NEW hook — ask/stream/abort/persist/copy
│   ├── sections/
│   │   ├── ProofLibrary.tsx    # NEW server — project cards (interactive bits are leaf client)
│   │   ├── ExperienceTimeline.tsx  # NEW server
│   │   └── HowItWorks.tsx      # NEW server
│   ├── ui/
│   │   ├── Card.tsx            # NEW primitive
│   │   └── Badge.tsx           # NEW primitive
│   ├── markdown.tsx            # NEW — message markdown renderer (extracted)
│   └── github-mark.tsx         # NEW — extracted inline SVG
├── lib/
│   ├── knowledge.ts            # + projectArchitectures, real arch data
│   ├── rag.ts                  # unchanged
│   ├── rate-limit.ts           # unchanged
│   └── motion.ts               # NEW — prefersReducedMotion()
└── next.config.ts              # + security headers
```

---

## Phase 0 — Local git baseline (enables commits)

### Task 0: Initialize git locally (no remote, no push)

**Files:** none (repo init)

- [ ] **Step 1: Confirm not already a repo**

Run: `git rev-parse --is-inside-work-tree 2>/dev/null || echo "not a repo"`
Expected: `not a repo`

- [ ] **Step 2: Init + first commit on a branch**

```bash
git init
git checkout -b main
git add -A
git commit -m "chore: baseline before local hardening"
```

- [ ] **Step 3: Verify .env.local is ignored**

Run: `git status --porcelain | grep ".env.local" || echo "ignored OK"`
Expected: `ignored OK` (the `.gitignore` already excludes `.env*` except `.env.example`)

---

## Phase 1 — Verified quick wins (a11y + security + resilience)

### Task 1: Add security headers + CSP

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Replace next.config.ts with header config**

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next injects inline runtime scripts; 'unsafe-inline' is required for app router hydration without nonces.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify headers are served**

```bash
npm run build && npm run start &
sleep 4
curl -sI http://localhost:3000/ | grep -iE "content-security-policy|x-frame-options|x-content-type"
kill %1
```
Expected: all three headers present.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts && git commit -m "feat(security): add CSP and hardening response headers"
```

### Task 2: Fix WCAG contrast failures (`text-stone-400`)

**Files:**
- Modify: `src/components/copilot-shell.tsx`

- [ ] **Step 1: Replace all low-contrast text-stone-400 with stone-600**

Run a scoped replace (the copy button, "Private" badge, and provider label use `text-stone-400`, which is ~2.6:1 on white — fails AA):
```bash
grep -n "text-stone-400" src/components/copilot-shell.tsx
```
For each match that is body/label/interactive text, change `text-stone-400` → `text-stone-600`. Leave `placeholder:text-stone-400` as-is only if you also set the placeholder to `placeholder:text-stone-500` (placeholders still need 4.5:1 if they convey instructions). Set placeholder to `stone-500`.

- [ ] **Step 2: Verify no failing tokens remain**

Run: `grep -n "text-stone-400\b" src/components/copilot-shell.tsx || echo "clean"`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add src/components/copilot-shell.tsx && git commit -m "fix(a11y): raise low-contrast text to meet WCAG AA"
```

### Task 3: Add skip-to-content link + main landmark

**Files:**
- Modify: `src/app/layout.tsx` (add skip link as first body child)
- Modify: `src/components/copilot-shell.tsx` (give the `<main>` an `id="main"` and `tabIndex={-1}`)

- [ ] **Step 1: Add skip link in layout body (before the JSON-LD script)**

```tsx
<body className="min-h-full flex flex-col">
  <a
    href="#main"
    className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-stone-950 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
  >
    Skip to content
  </a>
  <script ... />  {/* existing JSON-LD */}
  {children}
</body>
```

- [ ] **Step 2: Add id + tabIndex to the main element in copilot-shell.tsx**

Change `<main className="min-h-dvh bg-[#f4f3ef] text-stone-950">` to:
```tsx
<main id="main" tabIndex={-1} className="min-h-dvh bg-[#f4f3ef] text-stone-950 outline-none">
```

- [ ] **Step 3: Verify (keyboard) + build**

Run: `npm run build` (Expected: pass). Manually: load `npm run dev`, press Tab from page load → "Skip to content" appears and focuses main.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/copilot-shell.tsx
git commit -m "feat(a11y): add skip-to-content link and main landmark"
```

### Task 4: Extract reduced-motion util (TDD) and apply to auto-scroll

**Files:**
- Create: `src/lib/motion.ts`
- Test: `src/lib/motion.test.ts`
- Modify: `src/components/copilot-shell.tsx` (scroll effect)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/motion.test.ts
import { describe, expect, it, vi } from "vitest";
import { scrollBehavior } from "./motion";

describe("scrollBehavior", () => {
  it("returns 'auto' when reduced motion is preferred", () => {
    expect(scrollBehavior(true)).toBe("auto");
  });
  it("returns 'smooth' otherwise", () => {
    expect(scrollBehavior(false)).toBe("smooth");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/motion.test.ts`
Expected: FAIL — `scrollBehavior` not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/motion.ts
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollBehavior(reduced: boolean): ScrollBehavior {
  return reduced ? "auto" : "smooth";
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx vitest run src/lib/motion.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Use it in the scroll effect**

In `copilot-shell.tsx`, import `{ prefersReducedMotion, scrollBehavior }` and change:
```tsx
messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
```
to:
```tsx
messagesEndRef.current?.scrollIntoView({
  behavior: scrollBehavior(prefersReducedMotion()),
  block: "end",
});
```

- [ ] **Step 6: Verify + commit**

```bash
npm run lint && npm test && npm run build
git add src/lib/motion.ts src/lib/motion.test.ts src/components/copilot-shell.tsx
git commit -m "feat(a11y): honor prefers-reduced-motion for chat auto-scroll"
```

### Task 5: Add route error boundary

**Files:**
- Create: `src/app/error.tsx`

- [ ] **Step 1: Create error boundary**

```tsx
"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f4f3ef] px-6 text-center text-stone-800">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-stone-600">
        The copilot hit an unexpected error. Try again — your conversation is saved.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-10 items-center rounded-md bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
      >
        Reload
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm run build
git add src/app/error.tsx && git commit -m "feat: add route-level error boundary"
```

---

## Phase 2 — Credibility & product (real architecture + interview action + recruiter mode)

### Task 6: Replace the generic "Architecture Explorer" with the REAL system

**Why:** The panel currently hard-codes `React Native → FastAPI → PostgreSQL+Supabase → Vector retrieval → Redis+Celery → Groq`, which is NOT this app's architecture — a credibility ding for an "AI architect."

**Files:**
- Modify: `src/lib/knowledge.ts` (add typed architecture data)
- Modify: `src/components/copilot-shell.tsx` (render real data)

- [ ] **Step 1: Add architecture data to knowledge.ts**

Append:
```ts
export type ArchitectureView = {
  key: string;
  label: string;
  steps: { node: string; detail: string }[];
};

export const architectures: ArchitectureView[] = [
  {
    key: "this-site",
    label: "This site (Bhanu Copilot)",
    steps: [
      { node: "Next.js client", detail: "React 19 chat UI, streaming render" },
      { node: "Route handler /api/chat", detail: "Server-side, rate-limited" },
      { node: "Hybrid retrieval", detail: "Full profile index + keyword-scored evidence" },
      { node: "Groq LLaMA 3.3 70B", detail: "Streamed completion" },
      { node: "Grounded fallback", detail: "Local answer if Groq is unavailable" },
    ],
  },
  {
    key: "aura-ai",
    label: "Aura AI",
    steps: [
      { node: "React Native app", detail: "Mobile client" },
      { node: "FastAPI", detail: "Service + orchestration layer" },
      { node: "OpenCV + MediaPipe", detail: "Facial analysis, skin-tone detection" },
      { node: "Redis + Celery", detail: "Async AI processing" },
      { node: "GPT-4o assistant", detail: "Personalized consultation" },
    ],
  },
];
```

- [ ] **Step 2: Render the real architecture in the panel**

In `copilot-shell.tsx`, add `import { architectures } from "@/lib/knowledge"` and a state `const [archKey, setArchKey] = useState(architectures[0].key)`. Replace the hard-coded `["React Native / PWA", ...]` list with a selector + the selected view's steps:
```tsx
const activeArch = architectures.find((a) => a.key === archKey) ?? architectures[0];
// ...header with small select buttons over architectures...
{activeArch.steps.map((step, index) => (
  <div key={step.node} className="flex items-start gap-2">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-stone-100 font-mono text-xs text-stone-500">
      {index + 1}
    </span>
    <div>
      <p className="text-sm font-medium text-stone-800">{step.node}</p>
      <p className="text-xs leading-5 text-stone-600">{step.detail}</p>
    </div>
  </div>
))}
```
Change the panel's button to: `onClick={() => { setMode("architecture"); void ask(\`Explain the ${activeArch.label} architecture.\`); }}` and label it `Explain ${activeArch.label}`.

- [ ] **Step 3: Verify + commit**

```bash
npm run lint && npm test && npm run build
git add src/lib/knowledge.ts src/components/copilot-shell.tsx
git commit -m "feat: show real system architecture instead of generic stack"
```

### Task 7: Add a "Generate Interview Questions" hero action

**Why:** Your single strongest differentiator (LLM + RAG + product thinking in one click).

**Files:**
- Modify: `src/components/copilot-shell.tsx` (a prominent button in the chat input area, above the suggested-question chips)

- [ ] **Step 1: Add the button row above the featured-question chips**

```tsx
<button
  type="button"
  onClick={() => {
    setMode("recruiter");
    void ask("Generate 10 targeted interview questions a hiring manager could ask Bhanu, grounded in his real projects and tech.");
  }}
  className="mb-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white transition hover:bg-stone-800"
>
  <Sparkles size={15} aria-hidden="true" />
  Generate interview questions
</button>
```

- [ ] **Step 2: Verify + commit**

```bash
npm run build
git add src/components/copilot-shell.tsx
git commit -m "feat: one-click interview-question generator"
```

### Task 8: Recruiter-mode quick actions

**Why:** ~60% of recruiters won't type. Give one-tap intents when recruiter mode is active.

**Files:**
- Modify: `src/components/copilot-shell.tsx`

- [ ] **Step 1: Render quick-action buttons only in recruiter mode**

Below the mode toggle, conditionally render:
```tsx
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
```

- [ ] **Step 2: Verify + commit**

```bash
npm run build
git add src/components/copilot-shell.tsx
git commit -m "feat: recruiter-mode one-tap quick actions"
```

### Task 8a: Above-the-fold "Why hire Bhanu" scannable summary

**Why:** ~60% of recruiters won't type into a chat. Give an instant, non-interactive value prop.

**Files:** Create `src/components/sections/HireSummary.tsx`; render it directly under the header (before the chat section).

- [ ] **Step 1:** Build a compact strip from existing data: a one-line pitch, the 4 `impactMetrics`, top-3 project names (linked), and Resume/GitHub/LinkedIn buttons (reuse `profileSnapshot`). No new data.
- [ ] **Step 2:** Keep it `<= ~120px` tall on desktop, collapsible/condensed on mobile.
- [ ] **Step 3:** Verify + commit (`feat: above-the-fold hire summary`).

### Task 8b: "Paste a JD → fit analysis" feature

**Why:** The recruiter showstopper — paste a job description, the copilot maps Bhanu's fit. Pure prompt + UI, no new infra.

**Files:** Modify `useChat`/workspace to add a JD mode; add a small dialog/textarea trigger near the input.

- [ ] **Step 1:** Add a "Match a job description" button that opens a textarea (max ~4000 chars).
- [ ] **Step 2:** On submit, call `ask` with a framed prompt:
```ts
ask(`Here is a job description. Assess how well Bhanu fits it: list strong matches (with his real projects as evidence), partial matches, and genuine gaps. Be honest about gaps.\n\nJOB DESCRIPTION:\n${jd}`)
```
- [ ] **Step 3:** Server-side: the existing `clampMessages` caps content at 1600 — raise the per-message cap for this path or note JD is truncated; keep within Groq context. Verify the route still streams.
- [ ] **Step 4:** Verify + commit (`feat: paste a JD to get a fit analysis`).

### Task 8c: SEO + branding small fixes (viewport, favicon, extra schema, honest copy)

**Files:** Modify `src/app/layout.tsx`; create `src/app/icon.tsx`; modify `src/components/copilot-shell.tsx` (copy).

- [ ] **Step 1:** Add a `viewport` export with `themeColor`:
```ts
import type { Viewport } from "next";
export const viewport: Viewport = { themeColor: "#f4f3ef" };
```
- [ ] **Step 2:** Create `src/app/icon.tsx` (generated favicon via `next/og` `ImageResponse`, a simple "B." mark) so the default Next favicon is replaced.
- [ ] **Step 3:** Add `WebSite` JSON-LD alongside the existing `Person` script (name, url, `potentialAction` SearchAction optional-skip if no search route).
- [ ] **Step 4:** Tighten "Live AI Stack" copy: change "key never exposed" → a behavior-based line (e.g., "Server-side route handler"); soften tell-don't-show.
- [ ] **Step 5:** Verify + commit (`feat(seo): viewport theme-color, generated favicon, WebSite schema`).

---

## Phase 3 — Engineering quality (decompose the 913-line monolith)

> Do these in order; each step keeps the app working and verifiable via the gate. The goal is to remove the #1 repo red flag: one giant client component.

### Task 9: Extract `GithubMark` and the message markdown renderer

**Files:**
- Create: `src/components/github-mark.tsx` (move the inline SVG)
- Create: `src/components/markdown.tsx` (move `renderInlineMarkdown` + `formatContent`, export a `<MessageBody content role />`)
- Modify: `src/components/copilot-shell.tsx` (import from the new files; delete the moved code)

- [ ] **Step 1: Create `github-mark.tsx`** — paste the existing `GithubMark` function, add `export`.
- [ ] **Step 2: Create `markdown.tsx`** — move `renderInlineMarkdown` and `formatContent`; export `function MessageBody({ content, role }: { content: string; role: "user" | "assistant" })` that returns the mapped nodes wrapped in the existing `space-y-1` div.
- [ ] **Step 3: Update `copilot-shell.tsx`** — import `{ GithubMark }` and `{ MessageBody }`; replace the inline `formatContent(message.content, message.role)` call site with `<MessageBody content={message.content} role={message.role} />`; remove the now-moved local definitions.
- [ ] **Step 4: Verify + commit**

```bash
npm run lint && npm test && npm run build
git add src/components/github-mark.tsx src/components/markdown.tsx src/components/copilot-shell.tsx
git commit -m "refactor: extract GithubMark and message markdown renderer"
```

### Task 9b: Extend the markdown renderer (links, headings, inline code)

**Why (Audit 2 #11):** the current renderer only handles bold/bullets/numbered, so model output with links/headings/code renders flat; citations `[1]` aren't linked.

**Files:**
- Modify: `src/components/markdown.tsx`
- Test: `src/components/markdown.test.ts` (test the pure parse helpers, not JSX)

- [ ] **Step 1:** Refactor `renderInlineMarkdown` to also handle `[text](url)` links (render `<a target="_blank" rel="noreferrer" class="underline">`) and `` `code` `` (render `<code>`). Add `#`/`##`/`###` heading handling in `formatContent`.
- [ ] **Step 2:** Extract a pure `parseInline(text): Array<{type:'text'|'bold'|'code'|'link', value, href?}>` and unit-test it:
```ts
import { describe, expect, it } from "vitest";
import { parseInline } from "./markdown";
it("parses a link", () => {
  expect(parseInline("see [docs](https://x.com)")).toContainEqual({ type: "link", value: "docs", href: "https://x.com" });
});
```
- [ ] **Step 3:** Run `npx vitest run src/components/markdown.test.ts` → PASS.
- [ ] **Step 4:** Verify gate + commit (`feat: render links, headings, and inline code in answers`).

### Task 10: Add `<Card>` and `<Badge>` primitives + design tokens

**Files:**
- Create: `src/components/ui/Card.tsx`, `src/components/ui/Badge.tsx`
- Modify: `src/app/globals.css` (semantic tokens)
- Modify: `src/components/copilot-shell.tsx` (adopt `<Card>` where the repeated `rounded-lg border border-stone-200 bg-white p-4 shadow-sm` appears)

- [ ] **Step 1: Add tokens to globals.css**

```css
:root {
  --surface: #ffffff;
  --surface-muted: #fbfaf8;
  --border-subtle: #e7e5e4; /* stone-200 */
  --ink: #0c0a09;           /* stone-950 */
  --ink-muted: #57534e;     /* stone-600 */
}
```

- [ ] **Step 2: Create Card primitive**

```tsx
// src/components/ui/Card.tsx
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <section
      className={`rounded-lg border border-stone-200 bg-white p-4 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Create Badge primitive**

```tsx
// src/components/ui/Badge.tsx
import type { ReactNode } from "react";

export function Badge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600">
      {children}
    </span>
  );
}
```

- [ ] **Step 4:** Replace the ~10 repeated card `<section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">` instances with `<Card>`, and tag/stack chips with `<Badge>`.
- [ ] **Step 5: Verify + commit**

```bash
npm run lint && npm test && npm run build
git add -A && git commit -m "refactor(ui): add Card/Badge primitives and design tokens"
```

### Task 11: Extract `useChat` hook

**Files:**
- Create: `src/components/copilot/useChat.ts`
- Modify: `src/components/copilot-shell.tsx`

- [ ] **Step 1: Move chat state + behavior into a hook** that returns `{ messages, input, setInput, mode, setMode, isLoading, streamingId, copiedId, latestSources, ask, stopGenerating, startNewChat, copyMessage, inputRef, messagesEndRef }`. Move all 8 `useState`, the abort ref, the persistence effects, and the `ask/stopGenerating/startNewChat/copyMessage` functions verbatim into `useChat()`.
- [ ] **Step 2:** In `copilot-shell.tsx`, replace those declarations with `const chat = useChat();` and destructure.
- [ ] **Step 3: Verify (behavior unchanged) + commit**

```bash
npm run lint && npm test && npm run build
# manual: npm run dev — send a message, stop mid-stream, new chat, copy, refresh-persist all still work
git add -A && git commit -m "refactor: extract useChat hook from monolith"
```

### Task 12: Split the view into components; static sections become Server Components

**Files:**
- Create: `src/components/copilot/ChatPanel.tsx` (client), `src/components/copilot/SidePanels.tsx` (client)
- Create: `src/components/sections/ProofLibrary.tsx`, `ExperienceTimeline.tsx`, `HowItWorks.tsx` (server where possible)
- Modify: `src/app/page.tsx` to compose them; reduce/remove `copilot-shell.tsx`

- [ ] **Step 1:** Move the chat column JSX into `ChatPanel.tsx` (client; takes `chat` props or calls `useChat` internally) and the right rail into `SidePanels.tsx`. **While moving the rail, reduce overload (Audit UX):** keep **Evidence** + **Contact** always visible; merge "Signal Snapshot" + "Live AI Stack" + "Architecture Explorer" into a single compact, tabbed/collapsible panel so the rail stops competing with the chat.
- [ ] **Step 2:** Move the "Proof Library", "Experience Timeline", and "How it works" JSX into `sections/*`. These are static data → Server Components. The only interactive bit in Proof Library is the per-card "Ask copilot" button and the "Query projects" button — extract those as a tiny leaf client component `AskButton` that posts a `CustomEvent`/calls a passed handler. Simplest correct approach: keep ProofLibrary a client component for now (still a win — it's small and focused) and revisit server-conversion later. Prefer shipping the split over perfect RSC boundaries.
- [ ] **Step 3:** `page.tsx`:
```tsx
import { CopilotWorkspace } from "@/components/copilot/CopilotWorkspace";
import { ProofLibrary } from "@/components/sections/ProofLibrary";
import { ExperienceTimeline } from "@/components/sections/ExperienceTimeline";
import { HowItWorks } from "@/components/sections/HowItWorks";

export default function Home() {
  return (
    <main id="main" tabIndex={-1} className="min-h-dvh bg-[#f4f3ef] text-stone-950 outline-none">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <CopilotWorkspace />   {/* header + ChatPanel + SidePanels (client) */}
        <ProofLibrary />
        <ExperienceTimeline />
        <HowItWorks />
      </div>
    </main>
  );
}
```
- [ ] **Step 4: Verify (gate) + manual parity check + commit**

```bash
npm run lint && npm test && npm run build
git add -A && git commit -m "refactor: split monolith into ChatPanel, SidePanels, and section components"
```

- [ ] **Step 5:** Confirm `copilot-shell.tsx` is deleted or now a thin `CopilotWorkspace` wrapper (< ~200 LOC).

---

## Phase 4 — Polish & vision (optional, high-impact)

### Task 13: Contextual project detail panel (Layer 3)

**Files:** Create `src/components/copilot/ProjectPanel.tsx`; wire a `selectedProject` state in `useChat`/workspace so clicking a Proof-Library card opens an inline panel (title, summary, stack, repo/demo links, "Ask copilot") instead of only sending a message. Screenshots slot in later via `next/image`.

- [ ] Step 1: Build `ProjectPanel` from `portfolioProjects` data (no new data needed).
- [ ] Step 2: Card click opens the panel; keep the "Ask copilot" affordance inside it.
- [ ] Step 3: Verify + commit (`feat: contextual project detail panel`).

### Task 13b: Per-project deep-dive pages (SEO + depth)

**Why (Audit 2 #12 + SEO):** a chat-only SPA gives crawlers little text and no deep dives. Static routes add indexable content and a place for screenshots later.

**Files:** Create `src/app/projects/[slug]/page.tsx` (Server Component) + `src/lib/knowledge.ts` slug helper.

- [ ] **Step 1:** Add a `slug` to each `portfolioProjects` entry (or derive from name) and a `getProjectBySlug()` helper.
- [ ] **Step 2:** Build a server-rendered page per project from existing `knowledgeBase`/`portfolioProjects` data (title, summary, body, stack, repo/demo links). `generateStaticParams` for all slugs. `generateMetadata` per project.
- [ ] **Step 3:** Add the slugs to `sitemap.ts`. Link project cards' titles to `/projects/[slug]`.
- [ ] **Step 4:** Verify (`npm run build` prerenders the pages) + commit (`feat(seo): per-project deep-dive pages`).

### Task 14: Subtle motion with Framer Motion

**Files:** `npm i framer-motion`; animate message entry (fade/slide-up 8px) and panel mount. Respect `prefersReducedMotion()` (disable when true).

- [ ] Step 1: Install, wrap message bubble in `motion.div` with reduced-motion guard.
- [ ] Step 2: Verify + commit (`feat: subtle message entry animation`).

### Task 15: Dark mode

**Files:** `globals.css` (dark token values under `@media (prefers-color-scheme: dark)` + a `.dark` class), a header toggle in the workspace, persist choice in `localStorage`. Convert raw `stone-*`/`#f4f3ef` to token-driven classes where feasible.

- [ ] Step 1: Define dark tokens + `html.dark` strategy.
- [ ] Step 2: Add toggle + persistence.
- [ ] Step 3: Verify contrast in dark + commit (`feat: dark mode`).

---

## Phase 5 — Final verification

### Task 16: Full gate + a11y/contrast sweep

- [ ] **Step 1:** `npm run lint && npm test && npm run build` → all pass.
- [ ] **Step 2:** `grep -rn "text-stone-400\b" src/ || echo clean` → `clean`.
- [ ] **Step 3:** Manual: keyboard-only pass (skip link, tab order, focus rings), stop/persist/copy/new-chat, recruiter quick-actions, real architecture panel, interview button.
- [ ] **Step 4:** Final commit: `chore: local hardening complete`.

---

## Manual / later phase (NOT in this plan — needs you)

1. **Deploy:** push repo to GitHub → import to Vercel → set `GROQ_API_KEY`, `GROQ_MODEL`, `NEXT_PUBLIC_SITE_URL` → attach domain.
2. **Set real `NEXT_PUBLIC_SITE_URL`** so SEO/OG/sitemap/canonical are correct.
3. **Analytics:** enable Vercel Web Analytics in dashboard.
4. **Upstash rate limiting:** swap the in-memory limiter for `@upstash/ratelimit` (needs Upstash account) so the limit holds across serverless instances.
5. **Sentry:** add DSN for error monitoring.
6. **Screenshots:** capture per-project images → `next/image` in cards/ProjectPanel.
7. **Groq key rotation:** (deferred by you).
8. **Optional DB / vector RAG:** Supabase + pgvector if you later want true vector retrieval.

---

## Self-Review notes

- **Spec coverage (BOTH audits):** a11y (T2-4), security/CSP (T1), resilience (T5), real architecture (T6), interview generator (T7), recruiter mode (T8), above-fold hire summary (T8a), JD-fit feature (T8b), viewport/favicon/WebSite-schema/honest-copy (T8c), monolith decomposition (T9, T11, T12), markdown extension (T9b), design tokens/primitives (T10), rail consolidation (T12 Step 1), project panel (T13), per-project pages (T13b), motion (T14), dark mode (T15). **Deferred to manual phase (needs accounts/deploy):** deploy + real site URL, Vercel Analytics, Upstash rate limiting, Sentry, screenshots, Groq key rotation, optional DB/vector RAG, and lead-capture-with-notification (needs an email/Slack backend — a plain mailto already exists).
- **No placeholders:** every code/command step is concrete. Phase 3-4 larger refactors specify exact file boundaries, moved symbols, and the gate as the test (UI behavior is verified by build + manual parity, since the existing UI has no component tests to break).
- **Type consistency:** `useChat` returns the exact names used by `copilot-shell.tsx` today (`ask`, `stopGenerating`, `startNewChat`, `copyMessage`, `streamingId`, `latestSources`). `architectures`/`ArchitectureView` names match between knowledge.ts and the panel.
