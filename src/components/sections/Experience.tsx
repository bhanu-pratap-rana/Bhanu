import Link from "next/link";
import { PulledMark } from "@/components/chat/PulledMark";
import { RoleDisclosures } from "@/components/sections/RoleDisclosures";
import { experience, roleOwnBullets, roleProjects } from "@/lib/knowledge";
import { collapsesOnPhone, openByDefault } from "@/lib/role-disclosure";
import { workAnchorHref } from "@/lib/site";

const roleIds = experience.map((role) => role.id);

// The two most recent roles render open, which suits a laptop and no-JS; the
// older ones start collapsed (RoleDisclosures opens them all for printing).
// On a narrow screen this closes all but the first before the first paint,
// except a role the URL hash points at, so a shared link lands expanded.
//
// Say each thing once: a bullet that describes a project in Work (its
// `project` slug) becomes a link to that project, and "What I did" keeps only
// the role's own facts. No "Ask the copilot" per role: the launcher is always
// on screen (the same rule as Work's compact rows).
const collapseScript = `(function(){try{if(window.matchMedia("(max-width: 63.99rem)").matches){var h="";try{h=decodeURIComponent(location.hash.slice(1))}catch(e){}document.querySelectorAll("#experience details[data-collapse]").forEach(function(d){var li=d.closest("li[id]");if(!li||li.id!==h)d.removeAttribute("open")})}}catch(e){}})()`;

export function Experience() {
  return (
    <section
      tabIndex={-1}
      id="experience"
      className="section measure"
      aria-labelledby="experience-title"
    >
      <h2 id="experience-title" className="section-title">
        Experience
      </h2>
      <ol>
        {experience.map((role, index) => {
          const linked = roleProjects(role);
          const own = roleOwnBullets(role);
          return (
            <li
              key={role.id}
              id={role.id}
              tabIndex={-1}
              className="scroll-mt-4 border-t border-hairline py-6 first:border-t-0 first:pt-0 md:grid md:grid-cols-[15rem_minmax(0,46rem)] md:gap-8"
            >
              <div className="text-[15px] leading-[1.45] text-muted max-md:mb-2">
                <p className="text-ink">{role.period}</p>
                <p>{role.type}</p>
                <p>{role.place}</p>
              </div>
              <div>
                <h3 className="text-[20px] font-semibold leading-[1.25]">
                  {role.title}
                  <PulledMark
                    ids={
                      role.kbId === "khs-research-assistant"
                        ? [role.kbId, "assam-field-research"]
                        : [role.kbId]
                    }
                  />
                </h3>
                <p className="font-medium">{role.org}</p>
                {role.context ? (
                  <p className="mt-1 text-[15px] text-muted">{role.context}</p>
                ) : null}
                {linked.length > 0 ? (
                  <p className="mt-1 text-[16px]">
                    <span className="text-muted">
                      {linked.length === 1 ? "Project: " : "Projects: "}
                    </span>
                    {linked.map((project, at) => (
                      <span key={project.slug}>
                        {at > 0 ? ", " : ""}
                        <Link href={workAnchorHref(project)} className="link">
                          {project.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
                {/* No empty disclosure when every bullet is a project. */}
                {own.length > 0 ? (
                  <details
                    open={openByDefault(index)}
                    data-collapse={collapsesOnPhone(index) ? "" : undefined}
                    suppressHydrationWarning
                    className="mt-2"
                  >
                    <summary className="cursor-pointer py-2.5 text-[15px] text-muted marker:text-control">
                      What I did
                      <span className="sr-only"> at {role.org}</span>
                    </summary>
                    <ul className="mt-1 list-disc space-y-2 pl-5 marker:text-control">
                      {own.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <script dangerouslySetInnerHTML={{ __html: collapseScript }} />
      <RoleDisclosures roleIds={roleIds} />
    </section>
  );
}
