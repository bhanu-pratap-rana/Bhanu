import { ExternalLink, Search, Sparkles } from "lucide-react";
import { portfolioProjects } from "@/lib/knowledge";
import { GithubMark } from "@/components/github-mark";

export function ProofLibrary({
  onAsk,
}: Readonly<{ onAsk: (question: string) => void }>) {
  return (
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
          onClick={() => onAsk("Show me Bhanu's strongest projects.")}
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
                <h3 className="mt-1 text-base font-semibold">{project.name}</h3>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-600">
                  {project.role}
                </span>
                {project.isPrivate && (
                  <span className="rounded-md border border-stone-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-600">
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
                onClick={() => onAsk(`Tell me about ${project.name}.`)}
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
  );
}
