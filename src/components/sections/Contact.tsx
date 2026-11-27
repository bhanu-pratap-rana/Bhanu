import { CopyEmail } from "@/components/site/CopyEmail";
import { profile } from "@/lib/knowledge";

export function Contact() {
  return (
    <section
      tabIndex={-1}
      id="contact"
      className="section measure"
      aria-labelledby="contact-title"
    >
      <h2 id="contact-title" className="section-title">
        Contact
      </h2>
      <p className="flex flex-wrap items-center gap-x-3">
        <a
          href={`mailto:${profile.email}`}
          className="link display tap inline-flex items-center break-all text-[clamp(26px,6.4vw,40px)]"
        >
          {profile.email}
        </a>
        <CopyEmail email={profile.email} />
      </p>
      <p className="mt-3 text-muted">
        Email is the fastest way to reach me. I am based in {profile.location}.
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-5">
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
            className="link tap inline-flex items-center"
          >
            Résumé (PDF)
          </a>
        </li>
      </ul>
    </section>
  );
}
