import { createHash } from "node:crypto";
import { normalizeUnicodeText } from "./unicode";

export interface NormalizedCorpusRecord {
  id: string;
  sourceId: string;
  work: string;
  title: string;
  location: string;
  originalText: string;
  normalizedText: string;
  author?: string;
}

export type RawClassicInput = {
  sourceId: string;
  kind: "shijing" | "chuci" | "lunyu" | "poetry";
  data: unknown[];
};

export function normalizeAllusionRecords(inputs: RawClassicInput[]): NormalizedCorpusRecord[] {
  const records: NormalizedCorpusRecord[] = [];
  for (const input of inputs) {
    input.data.forEach((raw, recordIndex) => {
      if (!raw || typeof raw !== "object") return;
      const item = raw as Record<string, unknown>;
      const texts = Array.isArray(item.content)
        ? item.content
        : Array.isArray(item.paragraphs)
          ? item.paragraphs
          : [];
      texts
        .filter((text): text is string => typeof text === "string")
        .forEach((text, textIndex) => {
          const normalized = normalizeUnicodeText(text);
          const work = workName(input.kind);
          const title = String(
            item.title ?? item.chapter ?? item.rhythmic ?? `${work}-${recordIndex + 1}`,
          );
          const location = [item.chapter, item.section].filter(Boolean).join("·") || title;
          const digest = createHash("sha256")
            .update(
              `${input.sourceId}:${work}:${title}:${textIndex}:${normalized.normalizedText}`,
            )
            .digest("hex")
            .slice(0, 16);
          records.push({
            id: `${input.sourceId}:${digest}`,
            sourceId: input.sourceId,
            work,
            title,
            location,
            ...normalized,
            ...(typeof item.author === "string" ? { author: item.author } : {}),
          });
        });
    });
  }
  return records.sort((left, right) => left.id.localeCompare(right.id));
}

function workName(kind: RawClassicInput["kind"]): string {
  if (kind === "shijing") return "诗经";
  if (kind === "chuci") return "楚辞";
  if (kind === "lunyu") return "论语";
  return "古典诗词";
}
