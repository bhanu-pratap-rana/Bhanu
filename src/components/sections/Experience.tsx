import { AskButton } from "@/components/chat/AskButton";
import { PulledMark } from "@/components/chat/PulledMark";
import { CollapseOnPhone } from "@/components/sections/CollapseOnPhone";
import { experience, getKnowledgeItem } from "@/lib/knowledge";

// Every role is rendered open, which is right for laptops, print and no-JS.
// On a narrow screen this closes all but the first before the first paint.
const collapseScript = `(function(){try{if(window.matchMedia("(max-width: 63.99rem)").matches){document.querySelectorAll("#experience details[data-collapse]").forEach(function(d){d.removeAttribute("open")})}}catch(e){}})()`;

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
          const prompt =
            getKnowledgeItem(role.kbId)?.prompt ??
            `What did he do at ${role.org}?`;
          return (
            <li
              key={role.id}
              id={role.id}
              tabIndex={-1}
              className="scroll-mt-4 border-t border-hairline py-6 first:border-t-0 first:pt-0 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8"
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
                <details
                  open
                  data-collapse={index > 0 ? "" : undefined}
                  suppressHydrationWarning
                  className="mt-2"
                >
                  <summary className="cursor-pointer py-2.5 text-[15px] text-muted marker:text-control">
                    What I did
                    <span className="sr-only"> at {role.org}</span>
                  </summary>
                  <ul className="mt-1 list-disc space-y-2 pl-5 marker:text-control">
                    {role.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </details>
                <p className="mt-2">
                  <AskButton
                    question={prompt}
                    label={`Ask the copilot about ${role.org}`}
                  >
                    <span className="link text-[16px]">Ask the copilot</span>
                  </AskButton>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <script dangerouslySetInnerHTML={{ __html: collapseScript }} />
      <CollapseOnPhone selector="#experience details[data-collapse]" />
    </section>
  );
}
