import { Layers3 } from "lucide-react";
import { experienceTimeline } from "@/lib/knowledge";

export function ExperienceTimeline() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Layers3 size={18} aria-hidden="true" />
        <h2 className="text-sm font-semibold">Experience Timeline</h2>
      </div>
      <div className="mt-4 space-y-4">
        {experienceTimeline.map((item) => (
          <article key={`${item.org}-${item.role}`} className="relative pl-5">
            <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-stone-950" />
            <p className="text-sm font-semibold">{item.org}</p>
            <p className="mt-1 text-xs font-medium text-stone-500">
              {item.role} · {item.period}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{item.proof}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
