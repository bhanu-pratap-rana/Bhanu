# Personal LLM Copilot

A public-facing AI portfolio for Bhanu Pratap Rana. The first screen is a RAG-powered chat interface backed by a structured knowledge base from the resume, LinkedIn/profile text, projects, and research highlights.

## Stack

- Next.js route handlers for AI logic
- TypeScript and Tailwind CSS
- Groq chat completions API with **token streaming**
- Hybrid RAG: compact full-profile grounding plus local retrieval over structured source cards
- Per-IP rate limiting and a grounded local fallback
- Vitest unit tests for retrieval and rate limiting

## Run Locally

```bash
npm install
cp .env.example .env.local   # then add your GROQ_API_KEY
npm run dev
```

Add `GROQ_API_KEY` to `.env.local` to use Groq. Without a key, the app still works
with a deterministic local RAG fallback for development and demos.

### Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build + type check
npm run lint    # eslint
npm test        # vitest unit tests
```

## Environment

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Groq API key (server-only, never exposed to the client) |
| `GROQ_MODEL` | Groq model id (default `llama-3.1-8b-instant`) |
| `NEXT_PUBLIC_SITE_URL` | Public URL for SEO metadata, OpenGraph, and canonical links |

> Security: never commit a real key. `.env.local` is gitignored; `.env.example` ships placeholders only.

## How it works

1. The client posts the conversation + mode to `POST /api/chat`.
2. The route rate-limits per IP, then builds grounding context: a compact
   full-profile index plus the top retrieved source cards for the query.
3. Groq streams the answer back as plain text; retrieved sources travel in the
   `X-Sources` response header and render in the evidence panel.
4. If Groq is unavailable, a grounded local answer is streamed instead.

## Key Files

- `src/app/api/chat/route.ts` — server-side Groq streaming, rate limiting, fallback
- `src/lib/knowledge.ts` — structured knowledge base + `SourceRef` type
- `src/lib/rag.ts` — retrieval and prompt grounding helpers
- `src/lib/rate-limit.ts` — in-memory per-IP rate limiter
- `src/components/copilot-shell.tsx` — chat UI, recruiter/architecture modes, evidence panel
- `src/app/layout.tsx` — SEO metadata + JSON-LD Person schema
