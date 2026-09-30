import { createHash } from "node:crypto";
import type { NormalizedCorpusRecord } from "../normalize/allusions";

export function deriveAllusionCandidates(
  records: NormalizedCorpusRecord[],
  allowedCharacters: Set<string>,
) {
  const candidates = records.flatMap((record) => {
    const text = [...record.normalizedText].filter((char) => /\p{Script=Han}/u.test(char));
    return text
      .slice(0, -1)
      .map((char, index) => `${char}${text[index + 1]}`)
      .filter((fragment) => [...fragment].every((char) => allowedCharacters.has(char)))
      .map((selectedText) => {
        const id = createHash("sha256")
          .update(`${record.id}:${selectedText}`)
          .digest("hex")
          .slice(0, 16);
        return {
          id: `allusion-candidate:${id}`,
          sourceRecordId: record.id,
          sourceId: record.sourceId,
          work: record.work,
          title: record.title,
          location: record.location,
          quote: record.originalText,
          normalizedQuote: record.normalizedText,
          selectedText,
          reviewStatus: "unreviewed" as const,
          machineSuggestion: { interpretation: "", risks: [] as string[] },
        };
      });
  });
  return [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()].sort(
    (left, right) => left.id.localeCompare(right.id),
  );
}
