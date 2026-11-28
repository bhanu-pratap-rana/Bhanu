import Link from "next/link";
import { Download } from "lucide-react";
import { HomeLink } from "@/components/site/HomeLink";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { profile } from "@/lib/knowledge";
import { RESUME_FILENAME, sectionLinks } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="frame flex items-center gap-2 pt-2 text-[15px] lg:pt-5">
      <HomeLink name={profile.name} />
      {/* Five links plus the name (off the home page), the resume and the
          theme toggle need about 740px, so the bar shows them from lg; below
          that the hero lists the sections and project pages link back. */}
      <nav aria-label="Sections" className="max-lg:hidden">
        <ul className="flex items-center gap-5">
          {sectionLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="tap inline-flex items-center text-muted hover:text-ink">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <a
        href={profile.resumePath}
        // The icon says download, so the link downloads (not an in-tab viewer).
        download={RESUME_FILENAME}
        className="tap ml-3 inline-flex items-center gap-1.5 rounded-md border border-control px-3 font-medium text-ink hover:border-ink"
      >
        <Download size={16} aria-hidden="true" />
        Resume
      </a>
      <ThemeToggle />
    </header>
  );
}
