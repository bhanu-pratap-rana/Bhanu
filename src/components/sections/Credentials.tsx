import { Award, BadgeCheck, GraduationCap, ScrollText } from "lucide-react";
import {
  certifications,
  educationEntries,
  researchOutput,
} from "@/lib/knowledge";

export function Credentials() {
  return (
    <section className="border-t border-stone-200 py-6">
      <div className="flex items-center gap-2">
        <ScrollText size={18} aria-hidden="true" />
        <h2 className="text-xl font-semibold">Credentials & Research</h2>
      </div>
      <p className="mt-1 text-sm text-stone-600">
        Peer-reviewed publications, an award-winning conference record, and
        formal training behind the engineering work.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} aria-hidden="true" />
            <h3 className="text-sm font-semibold">Education</h3>
          </div>
          <ul className="mt-3 space-y-3">
            {educationEntries.map((item) => (
              <li key={item.degree}>
                <p className="text-sm font-medium text-stone-900">
                  {item.degree}
                </p>
                <p className="text-xs text-stone-600">{item.org}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {item.period} · {item.score}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Award size={16} aria-hidden="true" />
            <h3 className="text-sm font-semibold">Publications & Talks</h3>
          </div>
          <ul className="mt-3 space-y-3">
            {researchOutput.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-medium leading-5 text-stone-900">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-stone-600">
                  {item.venue}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-stone-500">{item.year}</span>
                  {item.award && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      <Award size={10} aria-hidden="true" />
                      Best Paper
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <BadgeCheck size={16} aria-hidden="true" />
            <h3 className="text-sm font-semibold">Certifications</h3>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {certifications.map((cert) => (
              <li
                key={cert}
                className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-700"
              >
                {cert}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
