import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProjectBySlug,
  getProjectDetail,
  portfolioProjects,
  projectSlug,
} from "@/lib/knowledge";

export function generateStaticParams() {
  return portfolioProjects.map((project) => ({ slug: projectSlug(project.name) }));
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
    openGraph: { title: project.name, description: project.summary },
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

  const detail = getProjectDetail(project.name);

  return (
    <main className="min-h-dvh bg-[#f4f3ef] text-stone-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="text-sm font-medium text-stone-600 underline-offset-2 hover:text-stone-950 hover:underline"
        >
          ← Back to copilot
        </Link>

        <header className="mt-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">
            {project.category}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
          <p className="mt-2 text-sm text-stone-600">
            {project.role}
            {project.isPrivate ? " · Private repository" : ""}
          </p>
        </header>

        <p className="mt-6 text-base leading-7 text-stone-700">
          {detail?.body ?? project.summary}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {project.stack.map((item) => (
            <span
              key={item}
              className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-600"
            >
              {item}
            </span>
          ))}
        </div>

        {(project.repoUrl || project.demoUrl) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-md bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                View code
              </a>
            )}
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 transition hover:border-stone-400"
              >
                Live demo
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
