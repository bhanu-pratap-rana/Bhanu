import type { Metadata } from "next";
import { Background } from "@/components/sections/Background";
import { Experience } from "@/components/sections/Experience";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Publications } from "@/components/sections/Publications";
import { Skills } from "@/components/sections/Skills";
import { Work } from "@/components/sections/Work";

// Set here, not in the layout, so only the home page claims "/". Shared
// `/?q=…` links resolve to this canonical.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <Hero />
      <Work />
      <Experience />
      <Skills />
      <Publications />
      <Background />
      {/* The copilot's design note closes the page; the footer's contact
          line follows it (SiteFooter). Section ids: pageSectionIds in
          src/lib/site.ts. */}
      <HowItWorks />
    </main>
  );
}
