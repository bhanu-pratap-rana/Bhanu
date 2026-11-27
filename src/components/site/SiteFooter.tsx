import { profile } from "@/lib/knowledge";
import { lastUpdatedIso, lastUpdatedLabel, sourceRepoUrl } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="measure mt-24 border-t border-hairline pb-28 pt-6 text-[15px] text-muted lg:pb-10">
      <p>
        {profile.name}, {profile.location}. Last updated{" "}
        <time dateTime={lastUpdatedIso}>{lastUpdatedLabel}</time>.{" "}
        <a href={sourceRepoUrl} target="_blank" rel="noreferrer noopener" className="link">
          Source for this site
        </a>
        .
      </p>
    </footer>
  );
}
