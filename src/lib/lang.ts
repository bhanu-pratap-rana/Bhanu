const DEVANAGARI = /[ऀ-ॿ]/g;

/** "hi" when most letters are Devanagari, so Hindi is read by a Hindi voice. */
export function langOf(text: string | undefined): "hi" | undefined {
  if (!text) return undefined;
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters) return undefined;
  const share = (text.match(DEVANAGARI)?.length ?? 0) / letters.length;
  return share > 0.3 ? "hi" : undefined;
}
