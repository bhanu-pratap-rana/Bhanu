import { skills } from "@/lib/knowledge";

export function Skills() {
  return (
    <section
      tabIndex={-1}
      id="skills"
      className="section measure"
      aria-labelledby="skills-title"
    >
      <h2 id="skills-title" className="section-title">
        Skills
      </h2>
      <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {skills.map((group) => (
          <div key={group.group}>
            <dt className="font-semibold">{group.group}</dt>
            <dd className="text-[16px] leading-[1.5] text-muted">
              {group.items.join(", ")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
