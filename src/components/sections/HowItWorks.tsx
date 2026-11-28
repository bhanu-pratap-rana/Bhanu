import Link from "next/link";
import { AskButton } from "@/components/chat/AskButton";
import { getKnowledgeItem, knowledgeBase } from "@/lib/knowledge";
import { RETRIEVAL_K } from "@/lib/rag";
import { evaluateRetrieval } from "@/lib/retrieval-golden";
import { sourceRepoUrl } from "@/lib/site";

const steps = [
  {
    node: "Your question",
    detail:
      "Split into words. A small word list adds synonyms and turns common Hindi and Hinglish words into their English terms.",
  },
  {
    node: "Keyword and tag match",
    detail: `Every note is scored on whole-word matches in its title, tags and text. The best ${RETRIEVAL_K} are kept; weak matches are dropped.`,
  },
  {
    node: "What the model is given",
    detail:
      "Those notes in full, numbered, plus a one-line index of every note. Nothing else about me.",
  },
  {
    node: "The answer",
    detail:
      "A Groq-hosted open model writes it and cites notes by number. Each number opens the note it points to.",
  },
  {
    node: "If the model is down",
    detail:
      "You get the matching notes directly, and the page says so instead of passing them off as the model.",
  },
];

/**
 * The retrieval check is computed here, at build time, from the same golden
 * questions the test suite runs, so the number on the page cannot go stale.
 */
export function HowItWorks() {
  // The pass count only: the misses (if any) belong in the test output, not
  // on the page.
  const result = evaluateRetrieval();
  const prompt =
    getKnowledgeItem("this-copilot")?.prompt ??
    "How does this copilot retrieve and cite?";

  return (
    <section id="how" tabIndex={-1} className="section measure" aria-labelledby="how-title">
      <h2 id="how-title" className="section-title">
        How the copilot on this page works
      </h2>
      <div className="space-y-4">
        <p>
          {`It answers from ${knowledgeBase.length} short notes I wrote from my resume and public repositories. It finds the right notes by keyword and tag matching. There are no embeddings and no vector database here, and all ${knowledgeBase.length} notes would fit in the model’s prompt anyway.`}
        </p>
        <p>
          I kept a retrieval step because a short numbered list makes every
          citation checkable, keeps each request small, and is the layer I
          would swap for embeddings if the notes grew a hundredfold. The
          project where embeddings were the right tool is{" "}
          <Link href="/#work-hindi-semantic-search" className="link">
            Hindi Semantic Search
          </Link>
          , which uses MiniLM and ChromaDB.
        </p>
      </div>

      <ol className="mt-6 border-t border-hairline">
        {steps.map((step, index) => (
          <li
            key={step.node}
            className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-b border-hairline py-3 md:grid-cols-[2rem_12rem_minmax(0,1fr)] md:gap-x-6"
          >
            <span className="text-muted">{index + 1}</span>
            <span className="font-semibold">{step.node}</span>
            <span className="text-[16px] leading-[1.5] text-muted max-md:col-start-2">
              {step.detail}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-4">
        <p>
          <span className="font-semibold">Checked on every build.</span> The
          retriever puts the right note at or near the top for {result.hits} of{" "}
          {result.total} test questions, including {result.byLang.hi.hits} of{" "}
          {result.byLang.hi.total} in Hindi and {result.byLang.hinglish.hits} of{" "}
          {result.byLang.hinglish.total} in Roman-script Hindi, and returns
          nothing for {result.offTopic.clean} of {result.offTopic.total}{" "}
          off-topic questions. I wrote both the questions and the word list, so this is a
          regression check, not a benchmark.
        </p>
        <p className="text-[16px] leading-[1.5] text-muted">
          Nothing in the prompt or the notes is private. Shared links can fill
          in a question but never send it. Links inside answers only work if
          they point to this site or to my own profiles.
        </p>
        <p className="flex flex-wrap gap-x-5">
          <AskButton question={prompt} mode="architecture">
            <span className="link">Ask it how it works</span>
          </AskButton>
          <a
            href={sourceRepoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="link tap inline-flex items-center"
          >
            Read the source
          </a>
        </p>
      </div>
    </section>
  );
}
