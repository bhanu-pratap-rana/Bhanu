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
        ? `Would pull ${count} of ${NOTE_COUNT} notes.`
        : "No note matches those keywords yet.";
    }
    if (view.phase === "preview") {
      return `That question would pull ${count} of ${NOTE_COUNT} notes.`;
    }
    if (view.phase !== "pulled") {
      return `The first question would pull ${count} of ${NOTE_COUNT} notes.`;
    }
  }
  switch (view.phase) {
    case "typing":
      return count > 0
        ? `Would pull ${count} of ${NOTE_COUNT} notes: ${titles(view, 2)}.`
        : "No note matches those keywords yet.";
    case "pulled":
      if (count === 0) {
        return "No note matched. The model saw only the one-line index.";
      }
      return busy
        ? `Pulled ${count} of ${NOTE_COUNT} notes. Reading them now.`
        : `Pulled ${count} of ${NOTE_COUNT} notes. The model cited ${view.citedCount}.`;
    case "preview":
      return `That question would pull ${count} of ${NOTE_COUNT} notes: ${titles(view, 2)}.`;
    default:
      return `The first question below would pull ${count} of ${NOTE_COUNT} notes: ${titles(view, 2)}.`;
  }
}

