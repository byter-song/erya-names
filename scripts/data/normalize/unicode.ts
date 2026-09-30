export interface NormalizedText {
  originalText: string;
  normalizedText: string;
  conversions: Array<{ from: string; to: string; index: number }>;
}

const punctuation = new Map([
  [",", "，"],
  ["!", "！"],
  ["?", "？"],
  [":", "："],
  [";", "；"],
]);

export function normalizeUnicodeText(
  originalText: string,
  conversionMap = new Map<string, string>(),
): NormalizedText {
  const normalizedCharacters: string[] = [];
  const conversions: NormalizedText["conversions"] = [];
  for (const raw of originalText.normalize("NFC")) {
    if (/\s/u.test(raw) && normalizedCharacters.at(-1)?.match(/[，。！？：；]/u)) continue;
    const punctuated = punctuation.get(raw) ?? raw;
    const converted = conversionMap.get(punctuated) ?? punctuated;
    if (converted !== punctuated)
      conversions.push({ from: punctuated, to: converted, index: normalizedCharacters.length });
    normalizedCharacters.push(converted);
  }
  return { originalText, normalizedText: normalizedCharacters.join(""), conversions };
}
