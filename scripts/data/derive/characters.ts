export interface CharacterReviewCandidate {
  id: string;
  char: string;
  pinyinSuggestions: string[];
  frequency: number;
  reviewStatus: "unreviewed";
  machineSuggestion: { namingSuitability: "unknown"; risks: string[] };
}

export function deriveCharacterCandidates(input: {
  standardCharacters: string;
  pinyin: Map<string, string[]>;
  corpusTexts: string[];
}): CharacterReviewCandidate[] {
  const frequency = new Map<string, number>();
  for (const text of input.corpusTexts)
    for (const char of text) frequency.set(char, (frequency.get(char) ?? 0) + 1);
  return [...new Set(input.standardCharacters)]
    .map((char) => ({
      id: `character:${char.codePointAt(0)?.toString(16).padStart(4, "0")}`,
      char,
      pinyinSuggestions: input.pinyin.get(char) ?? [],
      frequency: frequency.get(char) ?? 0,
      reviewStatus: "unreviewed" as const,
      machineSuggestion: {
        namingSuitability: "unknown" as const,
        risks: (input.pinyin.get(char)?.length ?? 0) > 1 ? ["multiple-pronunciation"] : [],
      },
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
