import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { normalizeAllusionRecords, type RawClassicInput } from "./normalize/allusions";
import { parsePinyinData } from "./normalize/pinyin";
import { parseTraditionalToSimplified } from "./normalize/opencc";
import { normalizeUnicodeText } from "./normalize/unicode";
import { deriveAllusionCandidates } from "./derive/allusions";
import { deriveCharacterCandidates } from "./derive/characters";
import { writeJsonl } from "./jsonl";
import standardCharacters from "../../src/data/curated/standard-characters.json";

const classicFiles: Array<{ path: string; sourceId: string; kind: RawClassicInput["kind"] }> = [
  { path: "诗经/shijing.json", sourceId: "chinese-poetry:shijing", kind: "shijing" },
  { path: "楚辞/chuci.json", sourceId: "chinese-poetry:chuci", kind: "chuci" },
  { path: "论语/lunyu.json", sourceId: "chinese-poetry:lunyu", kind: "lunyu" },
  { path: "四书五经/daxue.json", sourceId: "chinese-poetry:daxue", kind: "poetry" },
  { path: "四书五经/mengzi.json", sourceId: "chinese-poetry:mengzi", kind: "poetry" },
  { path: "四书五经/zhongyong.json", sourceId: "chinese-poetry:zhongyong", kind: "poetry" },
  { path: "全唐诗/poet.tang.0.json", sourceId: "chinese-poetry:tang-0", kind: "poetry" },
  { path: "宋词/宋词三百首.json", sourceId: "chinese-poetry:song-300", kind: "poetry" },
];

const conversionMap = parseTraditionalToSimplified(
  await readFile("data/cache/opencc/data/dictionary/TSCharacters.txt", "utf8"),
);
const inputs: RawClassicInput[] = [];
for (const file of classicFiles) {
  const raw: unknown = JSON.parse(
    await readFile(`data/cache/chinese-poetry/${file.path}`, "utf8"),
  );
  const values = Array.isArray(raw) ? raw : [raw];
  inputs.push({ ...file, data: values });
}
const corpus = normalizeAllusionRecords(inputs).map((record) => {
  const normalized = normalizeUnicodeText(record.originalText, conversionMap);
  return {
    ...record,
    normalizedText: normalized.normalizedText,
    conversions: normalized.conversions,
  };
});
const pinyin = parsePinyinData(await readFile("data/cache/pinyin-data/pinyin.txt", "utf8"));
const characters = deriveCharacterCandidates({
  standardCharacters: standardCharacters.characters,
  pinyin,
  corpusTexts: corpus.map((record) => record.normalizedText),
});
const allusions = deriveAllusionCandidates(corpus, new Set([...standardCharacters.characters]));

await writeJsonl("data/normalized/corpus.jsonl", corpus);
await writeJsonl("data/review/queue/characters.jsonl", characters);
await writeJsonl("data/review/queue/allusions.jsonl", allusions);
await mkdir("data/review/queue", { recursive: true });
const manifest = {
  version: "review-queue-2026.09.18",
  status: "unreviewed",
  inputs: classicFiles.map((file) => file.path),
  counts: { corpus: corpus.length, characters: characters.length, allusions: allusions.length },
  hashes: {
    corpus: hash(corpus),
    characters: hash(characters),
    allusions: hash(allusions),
  },
};
await writeFile(
  "data/review/queue/manifest.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(manifest, null, 2));

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
