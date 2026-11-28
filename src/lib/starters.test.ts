import { describe, expect, it } from "vitest";
import {
  JOB_DESCRIPTION_STARTER_INDEX,
  panelStarters,
  starterQuestions,
} from "./knowledge";

describe("starter order", () => {
  it("opens with the summary, a recruiter's first question", () => {
    expect(starterQuestions[0].question).toMatch(/^Summarise Bhanu/);
  });

  it("puts the question about this copilot itself last", () => {
    expect(starterQuestions.at(-1)?.question).toMatch(/this copilot/);
  });
});

describe("panelStarters", () => {
  const starters = panelStarters();

  it("puts the job-description entry second", () => {
    expect(JOB_DESCRIPTION_STARTER_INDEX).toBe(1);
    expect(starters[1]).toEqual({ kind: "job-description" });
  });

  it("has it exactly once", () => {
    expect(starters.filter((s) => s.kind === "job-description")).toHaveLength(1);
  });

  it("keeps every question, in order, with its language", () => {
    const questions = starters.flatMap((s) => (s.kind === "question" ? [s] : []));
    expect(questions.map(({ question, lang }) => ({ question, lang }))).toEqual(
      starterQuestions.map(({ question, lang }) => ({ question, lang })),
    );
  });
});
