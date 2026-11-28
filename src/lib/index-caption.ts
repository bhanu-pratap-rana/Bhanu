// The one-line captions that put the index's state into words. Pure, so the
// wording for each phase is testable; the lattice and the hero both use it.

import { NOTE_COUNT } from "./chat-store";
import type { IndexView } from "./index-view";
import { getKnowledgeItem, shortTitle } from "./knowledge";

function titles(view: IndexView, max: number): string {
  const names = view.ids
    .slice(0, max)
    .map((id) => getKnowledgeItem(id))
    .filter((item) => item !== undefined)
    .map(shortTitle);
  const rest = view.ids.length - names.length;
  return rest > 0 ? `${names.join(", ")} and ${rest} more` : names.join(", ");
}

export function captionFor(view: IndexView, busy: boolean, compact: boolean): string {
  const count = view.ids.length;
  // The strip has one line: the count only, never a clipped list of titles.
  if (compact) {
    if (view.phase === "typing") {
      return count > 0
        ? `Would read ${count} of ${NOTE_COUNT} notes.`
        : "No note matches those words yet.";
    }
    if (view.phase === "preview") {
      return `That question would read ${count} of ${NOTE_COUNT} notes.`;
    }
    if (view.phase !== "pulled") {
      return `The first question would read ${count} of ${NOTE_COUNT} notes.`;
    }
  }
  switch (view.phase) {
    case "typing":
      return count > 0
        ? `Would read ${count} of ${NOTE_COUNT} notes: ${titles(view, 2)}.`
        : "No note matches those words yet.";
    case "pulled":
      if (view.declined) return "Declined: outside what this copilot answers, so no notes were read.";
      if (count === 0) {
        return "No note matched, so it answered from a one-line summary of each.";
      }
      // Plain words for a recruiter; the mechanics live in the site's
      // "How the copilot works" section.
      return busy
        ? `Found ${count} of ${NOTE_COUNT} notes. Reading them now.`
        : `Answered from ${count} of ${NOTE_COUNT} notes; ${view.citedCount} cited.`;
    case "preview":
      return `That question would read ${count} of ${NOTE_COUNT} notes: ${titles(view, 2)}.`;
    default:
      return `The first question below would read ${count} of ${NOTE_COUNT} notes: ${titles(view, 2)}.`;
  }
}

/**
 * The source chips under an answer: only the cited ones show (1-based source
 * numbers, ascending, so a chip keeps the number its citation uses); the rest
 * fold behind a "+N more read" disclosure. While an answer streams, a note
 * moves from `more` to `shown` the moment its first citation arrives.
 */
export function splitSources(
  count: number,
  cited: readonly number[],
): { shown: number[]; more: number[] } {
  const citedSet = new Set(cited.filter((n) => Number.isInteger(n) && n >= 1 && n <= count));
  const shown: number[] = [];
  const more: number[] = [];
  for (let n = 1; n <= count; n += 1) (citedSet.has(n) ? shown : more).push(n);
  return { shown, more };
}

/** The disclosure's label for the notes it folds. */
export function moreReadLabel(shownCount: number, moreCount: number): string {
  if (moreCount <= 0) return "";
  if (shownCount > 0) return `+${moreCount} more read`;
  return `${moreCount} ${moreCount === 1 ? "note" : "notes"} read`;
}
