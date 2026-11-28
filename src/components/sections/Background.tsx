import {
  achievements,
  certifications,
  education,
  volunteer,
} from "@/lib/knowledge";

export function Background() {
  return (
    <section
      tabIndex={-1}
      id="background"
      className="section measure"
      aria-labelledby="background-title"
    >
      <h2 id="background-title" className="section-title">
        Background
      </h2>

      <h3 className="font-semibold">Education</h3>
      <ul className="mt-2">
        {education.map((entry) => (
          <li
            key={entry.degree}
            className="border-t border-hairline py-3 first:border-t-0 md:grid md:grid-cols-[15rem_minmax(0,46rem)] md:gap-8"
          >
            <p className="text-[15px] text-muted">{entry.period}</p>
            <p>
              {entry.degree}
              <span className="block text-[16px] text-muted">
                {entry.org}
                {entry.showScore ? `, ${entry.score}` : ""}
              </span>
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">Certifications</h3>
          <ul className="mt-2 space-y-2 text-[16px] leading-[1.45]">
            {certifications.map((item) => (
              <li key={item.name}>
                {item.name}
                <span className="block text-muted">
                  {item.issuer}, {item.year}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {/* The Best Paper Award is under Publications, with its paper. */}
        <div>
          <h3 className="font-semibold">Recognition</h3>
          <ul className="mt-2 space-y-2 text-[16px] leading-[1.45]">
            {achievements.map((item) => (
              <li key={item.title}>
                {item.title}
                <span className="block text-muted">
                  {item.by}
                  {item.year ? `, ${item.year}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className="mt-8 font-semibold">Volunteering</h3>
      <p className="mt-2">
        {volunteer.title}, {volunteer.org}
        <span className="block text-[16px] text-muted">{volunteer.period}</span>
      </p>
      <p className="mt-1 text-[16px] text-muted">{volunteer.summary}</p>
    </section>
  );
}
