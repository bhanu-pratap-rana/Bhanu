import Link from "next/link";
import { FocusCopilotButton } from "@/components/chat/FocusCopilotButton";
import { HeroAsk } from "@/components/chat/HeroAsk";
import { HeroLive } from "@/components/scene/HeroLive";
import { CopyEmail } from "@/components/site/CopyEmail";
import { sectionLinks } from "@/components/site/SiteHeader";
import { profile } from "@/lib/knowledge";

export function Hero() {
  return (
    <section
      id="top"
      tabIndex={-1}
      className="hero outline-none"
      aria-labelledby="name"
      data-core-hit
    >
      {/* The 3D core is drawn behind the page; this box tells it where to sit. */}
      <div className="hero-stage" data-core-stage aria-hidden="true" />

      <div className="hero-copy measure">
        <div className="lockup">
          <h1 id="name" className="lockup-latin">
            {profile.name}
          </h1>
          <p className="lockup-deva" lang="hi">
            {profile.nameHindi}
          </p>
        </div>

        <p className="hero-statement">{profile.statement}</p>

        <HeroLive />

        <div className="mt-3 lg:hidden">
          <HeroAsk />
        </div>

        <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[16px] lg:text-[17px]">
          <li className="max-lg:hidden">
            <FocusCopilotButton />
          </li>
          <li>
            <a
              href={profile.resumePath}
              className="link tap inline-flex items-center font-medium"
            >
              Résumé (PDF)
            </a>
          </li>
          <li>
            <a
              href={profile.github}
              target="_blank"
              rel="noreferrer noopener"
              className="link tap inline-flex items-center"
            >
              GitHub
            </a>
          </li>
          <li>
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noreferrer noopener"
              className="link tap inline-flex items-center"
            >
              LinkedIn
            </a>
          </li>
          <li className="flex items-center gap-1">
            <a
              href={`mailto:${profile.email}`}
              className="link tap inline-flex items-center"
            >
              {profile.email}
            </a>
            <CopyEmail email={profile.email} />
          </li>
        </ul>

        <p className="hero-status mt-4 max-w-[40rem] text-pretty text-[15px] leading-[1.5] text-muted md:text-[16px]">
          {profile.status}
        </p>

        <nav aria-label="Sections" className="mt-2 md:hidden">
          <ul className="flex flex-wrap gap-x-5 text-[15px]">
            {sectionLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="link tap inline-flex items-center text-muted"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
