import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AskButton } from "@/components/chat/AskButton";
import { ProjectGallery } from "@/components/sections/ProjectMedia";
import {
  basisLabel,
  getProjectBySlug,
  getProjectDetail,
  projects,
} from "@/lib/knowledge";
import { displayNoteBody } from "@/lib/note-display";
import { projectLinks } from "@/lib/project-media";
import { baseOpenGraph, workAnchorHref } from "@/lib/site";
import { showsBuiltWith, showsTopNote } from "./project-view";

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
    // openGraph replaces the layout's wholesale (shallow merge), and the root
    // opengraph-image file only fills images at its own level, so the shared
    // fields and the image are restated. twitter is set too, or it keeps the
    // layout's home-page title and description.
    openGraph: {
      ...baseOpenGraph,
      title: project.name,
      description: project.summary,
      url: `/projects/${project.slug}`,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: project.name,
      description: project.summary,
      images: ["/opengraph-image"],
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
  // For people: without the sentences that only keep the model from
  // over-claiming. The copilot still reads the whole note.
  const shown = detail ? displayNoteBody(detail.body) : null;
  const prompt = detail?.prompt ?? `Tell me about ${project.name}.`;

  return (
    <main id="main" tabIndex={-1} className="measure pt-6 outline-none lg:pt-12">
      <p>
        <Link
          href={workAnchorHref(project)}
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

      {showsTopNote(project, Boolean(detail)) ? (
        <p className="mt-3 text-muted">{project.note}</p>
      ) : null}

      <ul className="mt-4 flex flex-wrap items-center gap-x-5">
        {projectLinks(project, { details: false, codeLabel: "Code on GitHub" }).map(
          (link) => (
            <li key={link.kind}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="link tap inline-flex items-center"
              >
                {link.label}
              </a>
            </li>
          ),
        )}
        <li>
          <AskButton
            question={prompt}
            mode={project.pipeline ? "architecture" : "default"}
          >
            <span className="link">Ask the copilot about it</span>
          </AskButton>
        </li>
      </ul>

      <ProjectGallery project={project} />

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
          <p>{shown?.text}</p>
          <p className="mt-3 text-[15px] text-muted">
            {basisLabel[detail.basis]}.{" "}
            {shown?.trimmed
              ? `The copilot reads this note when you ask about ${project.name}, plus a line that keeps it from claiming more than the project does.`
              : `This is the note the copilot reads when you ask about ${project.name}.`}
          </p>
        </section>
      ) : null}

      {showsBuiltWith(project) ? (
        <section className="mt-12" aria-labelledby="stack-title">
          <h2 id="stack-title" className="section-title">
            Built with
          </h2>
          <p className="text-muted">{project.stack.join(", ")}</p>
        </section>
      ) : null}
    </main>
  );
}
