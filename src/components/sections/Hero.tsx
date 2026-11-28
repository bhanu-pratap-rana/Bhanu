import Link from "next/link";
import { HeroCta } from "@/components/chat/HeroCta";
import { HeroLive } from "@/components/scene/HeroLive";
import { CopyEmail } from "@/components/site/CopyEmail";
import { HeroStageFallback } from "@/components/sections/HeroStageFallback";
import { HexPortrait } from "@/components/site/HexPortrait";
import { eczarDeva } from "@/components/sections/hero-fonts";
import { currentRole, profile } from "@/lib/knowledge";
import { sectionLinks } from "@/lib/site";

/**
 * Phones: the core's band, then the name, statement, call to action and the
 * live starter. Laptops (page container >= 56rem): the copy is a column on
 * the left and the whole hero is the core's stage; the name deliberately
 * overhangs the column in front of the core. One DOM order for both, so the
 * tab order always follows what is seen. Layout lives in hero.css; the
 * core's placement in src/lib/core-stage.ts.
 */
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
      <div className="hero-stage" data-core-stage aria-hidden="true">
        <HeroStageFallback />
      </div>

      <div className="hero-copy" data-hero-copy>
        {/* Trust, not a second hero object: a small hex photo badge beside
            the name on phones, above it on laptops (hero.css). alt="": the h1
            right after it names him, so a screen reader would say it twice. */}
        <div className="hero-badge">
          <HexPortrait size={184} eager alt="" />
        </div>
        <div className="lockup">
          <h1 id="name" className="lockup-latin">
            {profile.name}
          </h1>
          <p className={`lockup-deva ${eczarDeva.variable}`} lang="hi">
            {profile.nameHindi}
          </p>
        </div>

        <p className="hero-role">
          {/* The resume title at the current employer, and its city, so his
              location is in the first viewport (knowledge.ts). */}
          <span className="hero-role-title">{currentRole.title}</span> at{" "}
          {currentRole.org}
          {currentRole.city ? `, ${currentRole.city}` : null}
        </p>

        <p className="hero-statement">{profile.statement}</p>

        <HeroCta />

        <HeroLive />

        <ul className="hero-links">
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
          <li className="hero-link-email">
            <a
              href={`mailto:${profile.email}`}
              className="link tap inline-flex items-center"
            >
              {profile.email}
            </a>
            <CopyEmail email={profile.email} />
          </li>
        </ul>

        {/* Until the header shows its section links (lg, SiteHeader). */}
        <nav aria-label="Sections" className="mt-2 lg:hidden">
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
