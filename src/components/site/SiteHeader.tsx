import Link from "next/link";
import { Download } from "lucide-react";
import { HomeLink } from "@/components/site/HomeLink";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { profile } from "@/lib/knowledge";

export const sectionLinks = [
  { href: "/#work", label: "Work" },
  { href: "/#experience", label: "Experience" },
  { href: "/#skills", label: "Skills" },
  { href: "/#publications", label: "Publications" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="measure flex items-center gap-2 pt-2 text-[15px] lg:pt-5">
      <HomeLink name={profile.name} />
      <nav aria-label="Sections" className="max-md:hidden">
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
        className="tap ml-3 inline-flex items-center gap-1.5 rounded-md border border-control px-3 font-medium text-ink hover:border-ink"
      >
        <Download size={16} aria-hidden="true" />
        Résumé
      </a>
      <ThemeToggle />
    </header>
  );
}
