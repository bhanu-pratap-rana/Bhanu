// Decides what the index lattice shows. Pure, so the rules ("never empty",
// "at most k cells", "cited cells carry their citation number") are testable.

import { countCitations } from "../components/markdown";
import { retrieve, type RankedCard } from "./rag";

export type CellView = {
  /** 0 = at rest. 1–3 = match strength, quantised so faint matches stay visible. */
  level: 0 | 1 | 2 | 3;
  /** The note was given to the model for the latest answer. */
  pulled: boolean;
  /** Citation number, when the latest answer cites this note. */
  cite?: number;
};

export type IndexPhase = "rest" | "preview" | "typing" | "pulled";

export type IndexView = {
  phase: IndexPhase;
  /** The question being previewed (rest and preview phases). */
  question?: string;
  /** Note ids in rank order (or citation order once pulled). */
  ids: string[];
  cells: Record<string, CellView>;
  citedCount: number;
};

export type IndexInput = {
  draft: string;
  preview: string | null;
  /** Earlier questions in this thread, oldest first. */
  questions: string[];
  /** The latest answer, if any. */
  answer?: { content: string; sources: string[] };
  /** Shown before anything has been asked, so the lattice is never blank. */
  restQuestion: string;
};

function levelFor(score: number, top: number): 1 | 2 | 3 {
  const ratio = top > 0 ? score / top : 0;
  if (ratio >= 0.67) return 3;
  if (ratio >= 0.34) return 2;
  return 1;
}

function fromRanked(ranked: RankedCard[]): Pick<IndexView, "ids" | "cells"> {
  const top = ranked[0]?.score ?? 0;
  const cells: Record<string, CellView> = {};
  for (const { item, score } of ranked) {
    cells[item.id] = { level: levelFor(score, top), pulled: false };
  }
  return { ids: ranked.map(({ item }) => item.id), cells };
}

export function deriveIndexView(input: IndexInput): IndexView {
  const draft = input.draft.trim();

  if (draft) {
    const { ranked } = retrieve({
      userMessages: [...input.questions, input.draft],
      partial: true,
    });
    return { phase: "typing", citedCount: 0, ...fromRanked(ranked) };
  }

  if (input.preview) {
    const { ranked } = retrieve({ userMessages: [input.preview] });
    return {
      phase: "preview",
      question: input.preview,
      citedCount: 0,
      ...fromRanked(ranked),
    };
  }

  if (input.answer) {
    const { sources, content } = input.answer;
    const { cited } = countCitations(content, sources.length);
    const cells: Record<string, CellView> = {};
    sources.forEach((id, index) => {
      const number = index + 1;
      cells[id] = {
        level: 1,
        pulled: true,
        cite: cited.includes(number) ? number : undefined,
      };
    });
    return { phase: "pulled", ids: sources, cells, citedCount: cited.length };
  }

  const { ranked } = retrieve({ userMessages: [input.restQuestion] });
  return {
    phase: "rest",
    question: input.restQuestion,
    citedCount: 0,
    ...fromRanked(ranked),
  };
}
