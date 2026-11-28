import { CopyEmail } from "@/components/site/CopyEmail";
import { profile } from "@/lib/knowledge";
import { FOOTER_ID, lastUpdatedIso, lastUpdatedLabel, RESUME_FILENAME } from "@/lib/site";

/**
 * One contact line on every page, not a section. The hero's email is hidden
 * on laptop windows under 800px tall (hero.css) and project pages have no
 * other email, so this line is where those visitors find it; at the end of a
 * long page it also saves the scroll back up. The id keeps old /#contact
 * links and the copilot's contact note landing here.
 */
export function SiteFooter() {
  return (
    <footer
      id={FOOTER_ID}
      tabIndex={-1}
      className="measure mt-24 scroll-mt-4 border-t border-hairline pb-28 pt-4 text-[15px] text-muted outline-none lg:pb-10"
    >
      <ul className="flex flex-wrap items-center gap-x-5">
        <li className="flex min-w-0 items-center gap-1">
          <a
            href={`mailto:${profile.email}`}
            className="link tap inline-flex min-w-0 items-center break-all text-ink"
          >
            {profile.email}
          </a>
          <CopyEmail email={profile.email} />
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
            href={profile.resumePath}
            download={RESUME_FILENAME}
            className="link tap inline-flex items-center"
          >
            Resume (PDF)
          </a>
        </li>
        <li className="tap inline-flex items-center">
          Last updated&nbsp;<time dateTime={lastUpdatedIso}>{lastUpdatedLabel}</time>
        </li>
      </ul>
    </footer>
  );
}
