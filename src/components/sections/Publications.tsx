import { AskButton } from "@/components/chat/AskButton";
import { publications } from "@/lib/knowledge";

export function Publications() {
  return (
    <section
      tabIndex={-1}
      id="publications"
      className="section measure"
      aria-labelledby="publications-title"
    >
      <h2 id="publications-title" className="section-title">
        Publications and presentations
      </h2>
      <ol>
        {publications.map((item) => (
          <li
            key={item.title}
            className="border-t border-hairline py-5 first:border-t-0 first:pt-0 md:grid md:grid-cols-[15rem_minmax(0,46rem)] md:gap-8"
          >
            <p className="text-[15px] leading-[1.45] text-muted max-md:mb-1">
              <span className="text-ink">{item.type}</span>
              <br />
              {item.year}
            </p>
            <div>
              <h3 className="font-semibold leading-[1.35]">{item.title}</h3>
              <p className="mt-1 text-[16px] leading-[1.5] text-muted">
                {item.citation}
              </p>
              {item.award ? (
                <p className="mt-1 font-semibold">{item.award}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2">
        <AskButton question="What has he published, and what was the Best Paper Award for?">
          <span className="link text-[16px]">
            Ask the copilot about my research
          </span>
        </AskButton>
      </p>
    </section>
  );
}
