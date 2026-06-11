import { Database, ExternalLink, Search } from "lucide-react";

const items = [
  {
    icon: Database,
    title: "Knowledge Base",
    body: "Resume/profile data is normalized into structured source cards for projects, roles, research, skills, and education.",
  },
  {
    icon: Search,
    title: "Retrieval Layer",
    body: "The API ranks relevant cards for every question and injects retrieved evidence beside the compact full-profile index.",
  },
  {
    icon: ExternalLink,
    title: "Recruiter Output",
    body: "Answers include concrete projects, technologies, metrics, and a visible evidence panel instead of generic portfolio copy.",
  },
];

export function HowItWorks() {
  return (
    <section className="grid gap-4 pb-8 md:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
        >
          <item.icon size={18} aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">{item.body}</p>
        </article>
      ))}
    </section>
  );
}
