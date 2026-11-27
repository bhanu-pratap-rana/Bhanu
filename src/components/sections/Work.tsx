import Link from "next/link";
import { AskButton } from "@/components/chat/AskButton";
import { PulledMark } from "@/components/chat/PulledMark";
import {
  getProjectDetail,
  moreWork,
  projects,
  type Project,
} from "@/lib/knowledge";

function ProjectLinks({ project }: Readonly<{ project: Project }>) {
  const prompt =
    getProjectDetail(project)?.prompt ?? `Tell me about ${project.name}.`;

  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-5 text-[16px]">
      <li>
        <Link
          href={`/projects/${project.slug}`}
          aria-label={`Details: ${project.name}`}
          className="link tap inline-flex items-center"
        >
          Details
        </Link>
      </li>
      {project.repoUrl ? (
        <li>
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Code: ${project.name}`}
            className="link tap inline-flex items-center"
          >
            Code
          </a>
        </li>
      ) : null}
      {project.demoUrl ? (
        <li>
          <a
            href={project.demoUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${project.demoLabel ?? "Demo"}: ${project.name}`}
            className="link tap inline-flex items-center"
          >
            {project.demoLabel ?? "Demo"}
          </a>
        </li>
      ) : null}
      <li>
        <AskButton
          question={prompt}
          label={`Ask the copilot about ${project.name}`}
        >
          <span className="link">Ask the copilot</span>
        </AskButton>
      </li>
    </ul>
  );
}

function Body({ project }: Readonly<{ project: Project }>) {
  return (
    <>
      <p>{project.summary}</p>
      <p className="mt-2 text-[15px] text-muted">{project.stack.join(", ")}</p>
      {project.note ? (
        <p className="mt-2 text-[15px] text-muted">{project.note}</p>
      ) : null}
      <ProjectLinks project={project} />
    </>
  );
}

export function Work() {
  const listed = projects.filter((project) => project.listed);
  const featured = listed.filter((project) => project.featured);
  const rest = listed.filter((project) => !project.featured);

  return (
    <section id="work" tabIndex={-1} className="section measure" aria-labelledby="work-title">
      <h2 id="work-title" className="section-title">
        Work
      </h2>

      <ul>
        {featured.map((project) => (
          <li
            key={project.slug}
            id={`work-${project.slug}`}
            tabIndex={-1}
            className="scroll-mt-4 border-t border-hairline py-6 first:border-t-0 first:pt-0 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8"
          >
            <div>
              <h3 className="display text-[32px]">
                {project.name}
                <PulledMark ids={[project.kbId]} />
              </h3>
              <p className="mt-2 text-balance text-[15px] leading-[1.4] text-muted max-md:mb-3">
                {project.attribution}
              </p>
            </div>
            <div>
              <Body project={project} />
            </div>
          </li>
        ))}
      </ul>

      <ul className="border-t border-hairline">
        {rest.map((project) => (
          <li
            key={project.slug}
            id={`work-${project.slug}`}
            tabIndex={-1}
            className="scroll-mt-4 border-b border-hairline py-5"
          >
            <h3 className="text-[20px] font-semibold leading-[1.25]">
              {project.name}
              <PulledMark ids={[project.kbId]} />
            </h3>
            <p className="mb-2 text-[15px] text-muted">{project.attribution}</p>
            <Body project={project} />
          </li>
        ))}
      </ul>

      <p id="work-more" tabIndex={-1} className="mt-5 scroll-mt-4 text-[16px] text-muted">
        Smaller public work:{" "}
        {moreWork.map((item, index) => (
          <span key={item.href}>
            {index > 0 ? ", " : ""}
            {item.href.startsWith("/") ? (
              <Link href={item.href} className="link text-ink">
                {item.label}
              </Link>
            ) : (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                className="link text-ink"
              >
                {item.label}
              </a>
            )}
          </span>
        ))}
        .
      </p>
    </section>
  );
}
