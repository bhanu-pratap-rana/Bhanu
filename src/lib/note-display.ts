// The copilot's notes are written for the model: besides what a project is,
// they say what it is NOT ("This project does not use FastAPI, Redis or
// Celery.", "PyTorch is not listed on his resume."), so the model never
// credits him with something he did not do. To a person reading a project
// page those lines look defensive, as if someone had claimed otherwise. The
// page drops them; the copilot keeps reading the whole note.

/** Sentences that exist only to stop the model from over-claiming. */
const MODEL_ONLY = [
  /^This (?:project|tool|app|site|repository) (?:does|did) not\b/i,
  // Matches "resume" with or without accents. No \b after it: JavaScript's \b
  // is ASCII-only, and an accented e is not a word character.
  /\b(?:is|are) not (?:listed|named|mentioned) (?:on|in) his r[eé]sum[eé]/i,
];

// A sentence ends at . ! or ? followed by whitespace, so "Next.js 16" and
// "0.85 F1" stay whole.
const SENTENCE_END = /(?<=[.!?])\s+/;

export type DisplayNote = {
  text: string;
  /** Something was left out, so the page must not call it the note verbatim. */
  trimmed: boolean;
};

/** A note's body for a person to read: the model-only sentences removed. */
export function displayNoteBody(body: string): DisplayNote {
  const sentences = body.split(SENTENCE_END).filter((sentence) => sentence.length > 0);
  const kept = sentences.filter(
    (sentence) => !MODEL_ONLY.some((pattern) => pattern.test(sentence)),
  );
  if (kept.length === sentences.length) return { text: body, trimmed: false };
  return { text: kept.join(" "), trimmed: true };
}
