import Link from "next/link";
import { AskButton } from "@/components/chat/AskButton";
import { PulledMark } from "@/components/chat/PulledMark";
import { ProjectCover, ProjectThumb } from "@/components/sections/ProjectMedia";
import {
  getProjectDetail,
  moreWork,
  projects,
  type Project,
} from "@/lib/knowledge";
import { coverMedia, projectLinks, thumbMedia } from "@/lib/project-media";

// The featured projects carry the full entry; the shorter list below them
// keeps only what a scan needs (notes live on the detail page, and the
// copilot's own entry points are always on screen), so it reads as a list,
// not a wall.
type Variant = "featured" | "compact";

function ProjectLinks({
  project,
  variant,
}: Readonly<{ project: Project; variant: Variant }>) {
  const prompt =
    getProjectDetail(project)?.prompt ?? `Tell me about ${project.name}.`;

  // Live app -> demo -> code -> details -> ask (src/lib/project-media.ts).
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-5 text-[16px]">
      {projectLinks(project).map((link) => (
        <li key={link.kind}>
          {link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={link.ariaLabel}
              className="link tap inline-flex items-center"
            >
              {link.label}
            </a>
          ) : (
            <Link
              href={link.href}
              aria-label={link.ariaLabel}
              className="link tap inline-flex items-center"
            >
              {link.label}
            </Link>
          )}
        </li>
      ))}
      {variant === "featured" ? (
        <li>
          <AskButton
            question={prompt}
            label={`Ask the copilot about ${project.name}`}
          >
            <span className="link">Ask the copilot</span>
          </AskButton>
        </li>
      ) : null}
    </ul>
  );
}

function Body({
  project,
  variant,
}: Readonly<{ project: Project; variant: Variant }>) {
  return (
    <>
      <p>{project.summary}</p>
      <p className="mt-2 text-[15px] text-muted">{project.stack.join(", ")}</p>
      {/* A card keeps a note only when it qualifies a link the card shows
          (e.g. "the hosted link shows the interface only"); every other
          caveat lives on the detail page. */}
      {variant === "featured" && project.note && (project.demoUrl || project.liveUrl) ? (
        <p className="mt-2 text-[15px] text-muted">{project.note}</p>
      ) : null}
      <ProjectLinks project={project} variant={variant} />
    </>
  );
}

/** A featured project's 16:10 cover, only when it has media. */
function Cover({ project }: Readonly<{ project: Project }>) {
  const media = coverMedia(project);
  return media ? <ProjectCover media={media} projectName={project.name} /> : null;
}

/** A listed project's row; a 64px thumbnail beside it only when it has media. */
function CompactRow({ project }: Readonly<{ project: Project }>) {
  const body = (
    <>
      <h3 className="text-[20px] font-semibold leading-[1.25]">
        {project.name}
        <PulledMark ids={[project.kbId]} />
      </h3>
      <p className="mb-2 text-[15px] text-muted">{project.attribution}</p>
      <Body project={project} variant="compact" />
    </>
  );
  const thumb = thumbMedia(project);
  if (!thumb) return body;
  return (
    <div className="flex items-start gap-4">
      <ProjectThumb media={thumb} />
      <div className="min-w-0 flex-1">{body}</div>
    </div>
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
            className="scroll-mt-4 border-t border-hairline py-6 first:border-t-0 first:pt-0 md:grid md:grid-cols-[15rem_minmax(0,46rem)] md:gap-8"
          >
            <div>
              <Cover project={project} />
              <h3 className="display text-[32px]">
                {project.name}
                <PulledMark ids={[project.kbId]} />
              </h3>
              <p className="mt-2 text-balance text-[15px] leading-[1.4] text-muted max-md:mb-3">
                {project.attribution}
              </p>
            </div>
            <div>
              <Body project={project} variant="featured" />
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
            <CompactRow project={project} />
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
