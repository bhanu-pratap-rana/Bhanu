# Bhanu Pratap Rana — portfolio with a retrieval copilot

The public portfolio at [bhanu-xi.vercel.app](https://bhanu-xi.vercel.app). Every fact is server-rendered and readable without typing anything. Beside it sits a copilot that answers questions from a small set of notes, shows which notes it retrieved, and cites them.

## What is in it

- **The page**: hero, work, experience, skills, publications, background and contact, all Server Components fed from `src/lib/knowledge.ts`.
- **The copilot**: a docked column on wide screens and a full-height dialog on phones. Answers stream from a Groq-hosted model and cite notes by number.
- **The index**: a lattice with one cell per note. It lights up as you type, using the same scoring function the server runs, so what you see is what the model is given.

## How retrieval works

Retrieval is lexical: keyword and tag matching over about two dozen hand-written notes, with a small synonym and Hindi/Hinglish word list. There are no embeddings and no vector database here. The notes would fit in the prompt; retrieval is kept because a short numbered list makes citations checkable and keeps requests small.

A golden set of questions (English, Hindi and Roman-script Hindi) is checked by the test suite, and the result is printed on the page from the same fixture.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- Groq chat completions with token streaming, and a fallback chain of models
- Vitest for retrieval, streaming, request validation, markdown and layout geometry
- No UI or animation libraries

## Run locally

```bash
npm install
cp .env.example .env.local   # then add your GROQ_API_KEY
npm run dev
```

Without a key the copilot still answers, straight from the matching notes, and says so.

```bash
npm run dev     # dev server
npm run build   # production build and type check
npm run lint    # eslint
npm test        # vitest
```

## Environment

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Groq API key. Server-only. |
| `GROQ_MODEL` | Optional. A model id to try first. If Groq has retired it, the route moves on to the maintained defaults in `src/lib/groq-models.ts`. |
| `NEXT_PUBLIC_SITE_URL` | Optional. Public origin for metadata; defaults to `https://bhanu-xi.vercel.app`. |

Never commit a real key. `.env.local` is gitignored.

## Request flow

1. The browser posts the recent turns to `POST /api/chat`.
2. The route validates and trims the request, rate-limits per IP, and retrieves the matching notes.
3. It tries each candidate model until one produces text, then streams it. The notes it used travel in the `X-Sources` header, in citation order.
4. If no model answers, it streams the matching notes instead and labels the answer as offline.

## Key files

- `src/lib/knowledge.ts` — all content and the notes the copilot retrieves
- `src/lib/rag.ts`, `src/lib/query-expansion.ts` — tokeniser, scoring, retrieval
- `src/lib/retrieval-golden.ts` — golden questions and the evaluation shown on the page
- `src/lib/groq-models.ts`, `src/lib/groq-stream.ts` — model fallback and stream handling
- `src/lib/chat-store.ts` — client chat state
- `src/lib/lattice.ts` — geometry of the index
- `src/app/api/chat/route.ts` — the chat endpoint
- `src/components/chat/` — copilot panel, index lattice, composer, thread
- `src/components/sections/` — page sections

## Updating content

Edit `src/lib/knowledge.ts`, replace `public/bhanu-pratap-rana-resume.pdf` if the résumé changed, and bump the date in `src/lib/site.ts`. Do not add a phone number or private email to `knowledge.ts`: that file ships to the browser.
