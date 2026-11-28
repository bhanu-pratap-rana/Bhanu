const DEVANAGARI = /[ऀ-ॿ]/g;

/** "hi" when most letters are Devanagari, so Hindi is read by a Hindi voice. */
export function langOf(text: string | undefined): "hi" | undefined {
  if (!text) return undefined;
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters) return undefined;
  const share = (text.match(DEVANAGARI)?.length ?? 0) / letters.length;
  return share > 0.3 ? "hi" : undefined;
}

// Common Hindi function words and verbs as they are written in Latin letters.
// Words that are also ordinary English ("the", "main", "par", "hum") are left
// out, so an English question never reads as Hinglish.
const HINGLISH_WORDS = new Set([
  "aap", "ab", "abhi", "acha", "accha", "anubhav", "aur", "bahut", "banaya",
  "banaye", "banao", "bata", "batao", "bataiye", "bataye", "bhai", "bhool",
  "bhul", "chahiye", "ek", "haan", "hai", "hain", "ho", "hoon", "hun", "jao",
  "jeeta", "ka", "kaam", "kab", "kahan", "kahaan", "kaise", "kaisa", "kaisi",
  "karein", "karen", "karna", "karo", "kaun", "kaunsa", "ke", "ki", "kiya",
  "kiye", "kijiye", "kitab", "kitaab", "kitna", "kitne", "ko", "koi", "kuch",
  "kya", "kyaa", "kyon", "kyun", "lekin", "liye", "likh", "likho", "mein",
  "mujhe", "nahi", "nahin", "ne", "padhai", "pichle", "saare", "sakte",
  "sampark", "sare", "se", "sirf", "sunao", "tha", "thi", "tum", "unhe",
  "unhone", "unka", "unke", "unki", "unko", "unse", "wala", "wali", "wo",
  "woh", "ye", "yeh", "zyada", "chutkula",
]);

// Hindi function words make up a large share of a Hinglish sentence. A long
// English paste (a job description) can hold a few by accident: "SE", "AB
// testing", "NE region".
const HINGLISH_MIN_SHARE = 0.1;

// Some of those words are also English acronyms and names ("AB testing",
// "SE", "Ho Chi Minh"). Hinglish writes them in lowercase, so a word counts
// only when it is lowercase, or capitalised as the first word of a sentence.
function countsAsHindi(word: string, sentenceStart: boolean): boolean {
  if (!HINGLISH_WORDS.has(word.toLowerCase())) return false;
  if (word === word.toLowerCase()) return true;
  return sentenceStart && word.slice(1) === word.slice(1).toLowerCase();
}

/**
 * Roman-script Hindi: at least two common Hindi words in Latin letters, and
 * at least a tenth of the Latin words.
 */
export function isHinglish(text: string | undefined): boolean {
  if (!text || langOf(text) === "hi") return false;
  const words: string[] = [];
  let hits = 0;
  for (const m of text.matchAll(/[A-Za-z]+/g)) {
    let i = m.index - 1;
    while (i >= 0 && /[ \t"'(“‘]/.test(text[i])) i--;
    const sentenceStart = i < 0 || /[.!?:\n]/.test(text[i]);
    words.push(m[0]);
    if (countsAsHindi(m[0], sentenceStart)) hits++;
  }
  return hits >= 2 && hits >= words.length * HINGLISH_MIN_SHARE;
}

export type ReplyScript = "en" | "hi" | "hinglish";

/** The script a reply should use: the script the visitor wrote in. */
export function replyScript(text: string | undefined): ReplyScript {
  if (langOf(text) === "hi") return "hi";
  return isHinglish(text) ? "hinglish" : "en";
}
