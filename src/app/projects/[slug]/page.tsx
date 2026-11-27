import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AskButton } from "@/components/chat/AskButton";
import {
  basisLabel,
  getProjectBySlug,
  getProjectDetail,
  projects,
} from "@/lib/knowledge";

// Only the listed slugs exist; anything else is a 404, not a render attempt.
export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "Project not found" };
  return {
    title: project.name,
    description: project.summary,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      title: project.name,
      description: project.summary,
      url: `/projects/${project.slug}`,
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const detail = getProjectDetail(project);
  const prompt = detail?.prompt ?? `Tell me about ${project.name}.`;

  return (
    <main id="main" tabIndex={-1} className="measure pt-6 outline-none lg:pt-12">
      <p>
        <Link
          href={`/#work-${project.slug}`}
          className="link tap inline-flex items-center text-[15px] text-muted"
        >
          Back to all work
        </Link>
      </p>

      <header className="mt-4">
        <h1 className="display text-[clamp(36px,9vw,60px)]">{project.name}</h1>
        <p className="mt-3 text-muted">{project.attribution}</p>
      </header>

      <p className="mt-6 text-[20px] font-medium leading-[1.35]">
        {project.summary}
      </p>

      {project.note ? <p className="mt-3 text-muted">{project.note}</p> : null}

      <ul className="mt-4 flex flex-wrap items-center gap-x-5">
        {project.repoUrl ? (
          <li>
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="link tap inline-flex items-center"
            >
              Code on GitHub
            </a>
          </li>
        ) : null}
        {project.demoUrl ? (
          <li>
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="link tap inline-flex items-center"
            >
              {project.demoLabel ?? "Demo"}
            </a>
          </li>
        ) : null}
        <li>
          <AskButton
            question={prompt}
            mode={project.pipeline ? "architecture" : "default"}
          >
            <span className="link">Ask the copilot about it</span>
          </AskButton>
        </li>
      </ul>

      {project.pipeline ? (
        <section className="mt-12" aria-labelledby="pipeline-title">
          <h2 id="pipeline-title" className="section-title">
            How it fits together
          </h2>
          <ol className="border-t border-hairline">
            {project.pipeline.map((step, index) => (
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
        </section>
      ) : null}

      {detail ? (
        <section className="mt-12" aria-labelledby="detail-title">
          <h2 id="detail-title" className="section-title">
            In more detail
          </h2>
          <p>{detail.body}</p>
          <p className="mt-3 text-[15px] text-muted">
            {basisLabel[detail.basis]}. This is the note the copilot reads when
            you ask about {project.name}.
          </p>
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="stack-title">
        <h2 id="stack-title" className="section-title">
          Built with
        </h2>
        <p className="text-muted">{project.stack.join(", ")}</p>
      </section>
    </main>
  );
}
