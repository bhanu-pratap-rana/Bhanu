// One word list for the lexical retriever: English synonyms, Hindi (Devanagari)
// and Hinglish (Roman-script Hindi), each mapped to English terms that exist in
// the card index. It is a dictionary lookup, not translation: a word that is
// not listed here simply does not match.
//
// Every target must be a real index term; query-expansion.test.ts fails on a
// dead entry. An empty list means "recognised, but carries no meaning for
// retrieval" (the owner's name).

export const expansions: Record<string, string[]> = {
  // English synonyms for section words
  study: ["education"],
  studied: ["education"],
  educational: ["education"],
  job: ["experience", "role"],
  career: ["experience"],
  company: ["experience"],
  deployed: ["deployment"],
  located: ["location"],
  city: ["location"],
  // English shorthand for stack terms
  db: ["database"],
  postgres: ["postgresql"],
  js: ["javascript"],
  nextjs: ["next.js"],
  mtech: ["m.tech"],

  // Hindi: sections of the profile
  "अनुभव": ["experience"],
  "नौकरी": ["job", "experience"],
  "काम": ["experience", "projects"],
  "परियोजना": ["project"],
  "प्रोजेक्ट": ["project"],
  "शोध": ["research"],
  "अनुसंधान": ["research"],
  "रिसर्च": ["research"],
  "प्रकाशन": ["publications"],
  "पेपर": ["paper"],
  "शिक्षा": ["education"],
  "पढ़ाई": ["education"],
  "डिग्री": ["degree"],
  "कौशल": ["skills"],
  "स्किल": ["skills"],
  "संपर्क": ["contact", "email"],
  "ईमेल": ["contact", "email"],
  "फ़ोन": ["contact", "phone"],
  "रिज़्यूमे": ["resume"],
  "पुरस्कार": ["award"],
  "अवार्ड": ["award"],
  "प्रमाणपत्र": ["certifications"],
  "इंटर्नशिप": ["internship"],
  "वर्तमान": ["current"],
  // Hindi: what the work is about
  "हिंदी": ["hindi"],
  "हिन्दी": ["hindi"],
  "भाषा": ["language"],
  "खोज": ["search"],
  "सर्च": ["search"],
  "आवाज़": ["voice"],
  "आवाज": ["voice"],
  "किताब": ["books"],
  "पुस्तक": ["books"],
  "छात्र": ["students"],
  "विद्यार्थी": ["students"],
  "शिक्षक": ["teachers"],
  "स्कूल": ["schools"],
  "असम": ["assam"],
  // Hindi: transliterated technical terms
  "एआई": ["ai"],
  "रैग": ["rag"],
  "एजेंट": ["agents"],
  // Hindi: the owner's name carries no retrieval meaning
  "भानु": [],
  "प्रताप": [],
  "राणा": [],

  // Hinglish
  anubhav: ["experience"],
  naukri: ["job", "experience"],
  kaam: ["experience", "projects"],
  padhai: ["education"],
  shiksha: ["education"],
  kaushal: ["skills"],
  sampark: ["contact", "email"],
  puraskar: ["award"],
  prakashan: ["publications"],
  shodh: ["research"],
  khoj: ["search"],
  kitab: ["books"],
  kitaab: ["books"],
  awaaz: ["voice"],
  chhatra: ["students"],
};

const NUKTA = /\u093c/g;
const CHANDRABINDU = /\u0901/g;
// A nasal consonant with a virama before another consonant is commonly typed
// as an anusvara instead: हिन्दी / हिंदी, सम्पर्क / संपर्क.
const HALF_NASAL = /[\u0919\u091e\u0923\u0928\u092e]\u094d(?=[\u0915-\u0939])/g;
const DEVANAGARI = /[\u0900-\u097f]/;

/**
 * Folds the spelling variants of one Devanagari word onto one key: nukta
 * dropped, chandrabindu and half-nasals written as anusvara. Used for lookup
 * only, never shown.
 */
export function foldDevanagari(token: string): string {
  if (!DEVANAGARI.test(token)) {
    return token;
  }
  return token
    .normalize("NFC")
    .replace(NUKTA, "")
    .replace(CHANDRABINDU, "\u0902")
    .replace(HALF_NASAL, "\u0902");
}

// Plural and oblique endings (किताबें, किताबों, परियोजनाएं, परियोजनाओं) and the
// English plural written in Devanagari (प्रोजेक्ट्स).
const HINDI_ENDINGS = ["\u094b\u0902", "\u0947\u0902", "\u0913\u0902", "\u090f\u0902", "\u094d\u0938"];

function hindiStem(key: string): string {
  for (const ending of HINDI_ENDINGS) {
    if (key.endsWith(ending) && key.length - ending.length >= 2) {
      return key.slice(0, -ending.length);
    }
  }
  return key;
}

function toKey(token: string): string {
  return foldDevanagari(token.normalize("NFC").toLowerCase());
}

const table = new Map<string, string[]>(
  Object.entries(expansions).map(([word, terms]) => [toKey(word), terms]),
);

/** The table's keys as looked up, for prefix matching while a word is typed. */
export const expansionKeys: string[] = [...table.keys()];

function lookup(token: string): string[] | undefined {
  const key = toKey(token);
  return table.get(key) ?? (DEVANAGARI.test(key) ? table.get(hindiStem(key)) : undefined);
}

/**
 * Looks one normalised query token up in the table. A listed word returns its
 * index terms and `from` (the word as given); any other word returns itself.
 */
export function expandToken(token: string): { terms: string[]; from?: string } {
  const terms = lookup(token);
  if (!terms) {
    return { terms: [token] };
  }
  return { terms: [...terms], from: token };
}
