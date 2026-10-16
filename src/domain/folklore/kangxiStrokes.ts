export interface KangxiStrokeRecord {
  character: string;
  kangxiForm: string;
  strokeCount?: number | null;
  reviewStatus: "reviewed" | "research_only";
  dictionaryIndex?: string | null;
  imagePage?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export function resolveKangxiStrokes(text: string, records: readonly KangxiStrokeRecord[]) {
  const byCharacter = new Map<string, KangxiStrokeRecord[]>();
  for (const record of records)
    byCharacter.set(record.character, [...(byCharacter.get(record.character) ?? []), record]);

  const characters = [...text];
  const resolved = characters.map((character) => {
    const reviewed = (byCharacter.get(character) ?? []).filter(
      (record) =>
        record.reviewStatus === "reviewed" &&
        Number.isInteger(record.strokeCount) &&
        (record.strokeCount ?? 0) > 0,
    );
    const counts = [...new Set(reviewed.map((record) => record.strokeCount as number))];
    if (counts.length !== 1) return { character, status: "unknown" as const };
    const record = reviewed[0]!;
    return {
      character,
      status: "reviewed" as const,
      kangxiForm: record.kangxiForm,
      strokeCount: counts[0]!,
      ...(record.dictionaryIndex ? { dictionaryIndex: record.dictionaryIndex } : {}),
      ...(record.imagePage ? { imagePage: record.imagePage } : {}),
    };
  });
  const missingCharacters = [
    ...new Set(
      resolved.filter((item) => item.status === "unknown").map((item) => item.character),
    ),
  ];

  return missingCharacters.length
    ? {
        status: "unknown" as const,
        characters: resolved,
        missingCharacters,
        strokeCounts: undefined,
      }
    : {
        status: "reviewed" as const,
        characters: resolved,
        missingCharacters: [],
        strokeCounts: resolved.flatMap((item) =>
          item.status === "reviewed" ? [item.strokeCount] : [],
        ),
      };
}
