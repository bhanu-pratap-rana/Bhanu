// What a project page shows once, and where. Kept free of JSX so the rules
// can be tested (vitest runs .test.ts only).
import type { Project } from "@/lib/knowledge";

/**
 * The caveat under the summary. The detail note ("In more detail") already
 * states every project's caveat in context, so the top copy stays only when
 * it qualifies a link shown right there ("the hosted link shows the interface
 * only"), the same rule the home cards use, or when there is no detail note.
 */
export function showsTopNote(
  project: Pick<Project, "note" | "demoUrl" | "liveUrl">,
  hasDetail: boolean,
): boolean {
  if (!project.note) return false;
  return Boolean(project.demoUrl || project.liveUrl) || !hasDetail;
}

/**
 * "Built with" is the scannable tool list for projects without a pipeline;
 * with one, the pipeline and the detail note already name the tools.
 */
export function showsBuiltWith(project: Pick<Project, "pipeline">): boolean {
  return !project.pipeline;
}
