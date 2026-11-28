import { describe, expect, it } from "vitest";
import {
  achievements,
  currentRole,
  experience,
  getProjectBySlug,
  knowledgeBase,
  projects,
  publications,
  roleOwnBullets,
  roleProjects,
  type ExperienceEntry,
} from "./knowledge";
import { retrieveKnowledge, tokenize } from "./rag";
import { FOOTER_ID, pageSectionIds, sectionLinks, WORK_MORE_ID } from "./site";

describe("knowledge base labels", () => {
  it("gives every tag and alias at least one indexable word", () => {
    // A label made only of stop words ("about", "who", "won") is dropped by
    // the tokenizer, so it can never match and only misleads the reader.
    const dead = knowledgeBase.flatMap((item) =>
      [...item.tags, ...(item.aliases ?? [])]
        .filter((label) => tokenize(label).length === 0)
        .map((label) => `${item.id}: ${label}`),
    );
    expect(dead).toEqual([]);
  });
});

describe("plain 'resume' spelling keeps retrieval working", () => {
  it("still finds the contact note for a visitor who types the accented word", () => {
    expect(retrieveKnowledge("Where can I download his résumé?", 3).map((item) => item.id)).toContain(
      "contact",
    );
    expect(retrieveKnowledge("Can I get his resume?", 3).map((item) => item.id)).toContain("contact");
  });
});

describe("currentRole: the hero's and the link card's role line", () => {
  it("is the resume title at the current employer, without the ministry", () => {
    expect(currentRole).toEqual({
      title: "Technical Assistant / Computer Assistant",
      org: "Kendriya Hindi Sansthan",
      line: "Technical Assistant / Computer Assistant at Kendriya Hindi Sansthan",
      city: "Agra",
    });
  });

  it("comes from the first role still running, in resume order", () => {
    const running = experience.find((role) => role.period.endsWith("Present"));
    expect(running?.title).toContain(currentRole.title);
    expect(running?.org.startsWith(currentRole.org)).toBe(true);
    expect(running?.place.startsWith(currentRole.city ?? "")).toBe(true);
  });
});

describe("note anchors: every 'Go to the section' and citation link lands somewhere", () => {
  // The ids the home page renders: its sections, the rows inside Work and
  // Experience, and the footer's contact line (outside <main>).
  const homeIds = new Set<string>([
    ...pageSectionIds,
    FOOTER_ID,
    WORK_MORE_ID,
    ...projects.filter((project) => project.listed).map((project) => `work-${project.slug}`),
    ...experience.map((role) => role.id),
  ]);

  it("resolves each note's anchor to a section, a row in one, or the footer", () => {
    const dead = knowledgeBase
      .filter((item) => !homeIds.has(item.anchor))
      .map((item) => `${item.id} -> #${item.anchor}`);
    expect(dead).toEqual([]);
  });

  it("keeps the contact note on the footer's contact line", () => {
    expect(knowledgeBase.find((item) => item.id === "contact")?.anchor).toBe(FOOTER_ID);
  });

  it("links the section nav only to sections the page has (no Contact section)", () => {
    for (const link of sectionLinks) {
      expect(pageSectionIds as readonly string[], link.href).toContain(link.href.replace("/#", ""));
    }
    expect(sectionLinks.map((link) => link.label)).not.toContain("Contact");
  });
});

describe("experience bullets tied to a project", () => {
  it("names only projects that exist", () => {
    const unknown = experience.flatMap((role) =>
      role.bullets
        .filter((bullet) => bullet.project && !getProjectBySlug(bullet.project))
        .map((bullet) => `${role.id}: ${bullet.project}`),
    );
    expect(unknown).toEqual([]);
  });

  it("links each role to the projects its bullets describe, once each, in bullet order", () => {
    const slugs = (id: string) =>
      roleProjects(experience.find((role) => role.id === id)!).map((project) => project.slug);
    expect(slugs("experience-khs")).toEqual(["atal-ai-2-0", "hindi-semantic-search"]);
    expect(slugs("experience-aura")).toEqual(["aura-ai"]);
    expect(slugs("experience-testneo")).toEqual(["api-test-case-generator"]);
    expect(slugs("experience-bytical")).toEqual([]);
  });

  it("shows under 'What I did' only the bullets no project already tells", () => {
    for (const role of experience) {
      expect(roleOwnBullets(role)).toEqual(
        role.bullets.filter((bullet) => !bullet.project).map((bullet) => bullet.text),
      );
    }
    const testneo = experience.find((role) => role.id === "experience-testneo")!;
    expect(roleOwnBullets(testneo)).toEqual([]);
  });

  it("keeps a bullet whose project slug is unknown, so no text silently disappears", () => {
    const role: ExperienceEntry = {
      ...experience[0],
      bullets: [
        { text: "Built a thing.", project: "no-such-project" },
        { text: "Built ATAL AI.", project: "atal-ai-2-0" },
        { text: "Also built ATAL AI tests.", project: "atal-ai-2-0" },
      ],
    };
    expect(roleOwnBullets(role)).toEqual(["Built a thing."]);
    expect(roleProjects(role).map((project) => project.slug)).toEqual(["atal-ai-2-0"]);
  });
});

describe("each award appears once on the page", () => {
  it("does not list a publication's award again under Recognition", () => {
    const awards = publications.flatMap((item) => (item.award ? [item.award] : []));
    expect(awards.length).toBeGreaterThan(0);
    for (const item of achievements) {
      for (const award of awards) {
        expect(award.startsWith(item.title), item.title).toBe(false);
      }
    }
  });
});
