import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (path) =>
  JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const bundle = read("src/data/curated/personal-bundle.json");
const standard = new Set(read("src/data/curated/standard-characters.json").characters);
const { characters, allusions, modernCombinations, personUsages = [] } = bundle;
const failures = [];
const hash = createHash("sha256")
  .update(
    JSON.stringify({
      characters,
      allusions,
      ...(modernCombinations ? { modernCombinations } : {}),
      ...(personUsages.length ? { personUsages } : {}),
    }),
  )
  .digest("hex");
if (hash !== bundle.manifest.contentHash) failures.push("Personal bundle hash mismatch");
if (bundle.manifest.status !== "personal") failures.push("Personal bundle status mismatch");
if (new Set(characters.map((x) => x.char)).size !== characters.length)
  failures.push("Duplicate characters");
for (const char of characters) {
  if (
    !standard.has(char.char) ||
    !char.sourceRefs.some((x) => x.sourceId === "standard-hanzi-2013") ||
    !char.pinyin.length ||
    !char.meanings.length ||
    !char.strokes
  )
    failures.push(`Incomplete character ${char.char}`);
  if (char.reviewStatus !== "source_checked" || !char.checkedAt)
    failures.push(`Review provenance missing ${char.char}`);
}
if (modernCombinations) {
  const names = new Set(allusions.map((item) => item.selectedText));
  const chars = new Set(characters.map((item) => item.char));
  if (
    modernCombinations.length !== 500 ||
    new Set(modernCombinations.map((item) => item.givenName)).size !== 500
  )
    failures.push("Modern collection must contain 500 unique names");
  for (const item of modernCombinations)
    if (
      [...item.givenName].length !== 2 ||
      [...item.givenName].some((char) => !chars.has(char)) ||
      names.has(item.givenName) ||
      !item.meaning ||
      !item.usageNote
    )
      failures.push(`Invalid combination ${item.givenName}`);
}
for (const item of allusions) {
  let position = -1;
  for (const char of item.selectedText) {
    position = item.quote.indexOf(char, position + 1);
    if (position < 0) {
      failures.push(`False quote ${item.id}`);
      break;
    }
  }
  if (!item.sourceRefs.length || !item.interpretation || !item.risks.length)
    failures.push(`Incomplete allusion ${item.id}`);
  if (
    !item.corpusScore ||
    !item.corpusScore.accepted ||
    item.corpusScore.total < item.corpusScore.threshold ||
    item.corpusScore.modelVersion !== "corpus-score-1"
  )
    failures.push(`Allusion did not pass corpus scoring ${item.id}`);
  if (
    item.corpusScore.deductions.some(
      (deduction) => !deduction.id || deduction.points <= 0 || !deduction.explanation,
    )
  )
    failures.push(`Invalid corpus deduction ${item.id}`);
}
for (const usage of personUsages) {
  if (
    !usage.id ||
    !/^[\p{Script=Han}]{2,4}$/u.test(usage.name) ||
    !usage.period ||
    !usage.description ||
    !usage.checkedAt ||
    !usage.sourceRefs?.length
  )
    failures.push(`Incomplete person usage ${usage.id}`);
  if (
    usage.identityType !== "historical_person" &&
    (!usage.rankEvidence || !usage.rankEvidence.trim())
  )
    failures.push(`Imperial-exam usage lacks rank evidence ${usage.id}`);
}
for (const [file, expected] of [
  [
    "chinese-poetry-LICENSE.txt",
    "c195319aeaa3ffcbe16aa5d26eec19eae5a42f84337dd2b3dc3c9d5ccbbd6507",
  ],
  ["unicode-LICENSE.txt", "e7a93b009565cfce55919a381437ac4db883e9da2126fa28b91d12732bc53d96"],
]) {
  const actual = createHash("sha256")
    .update(readFileSync(new URL(`../../data/sources/personal/${file}`, import.meta.url)))
    .digest("hex");
  if (actual !== expected) failures.push(`License mismatch ${file}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Personal data audit passed: ${characters.length} characters, ${allusions.length} allusions, ${modernCombinations?.length ?? 0} modern combinations, ${personUsages.length} person usages. Source checked by machine; not a human-reviewed production corpus.`,
  );
