import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = JSON.parse(
  await readFile("data/sources/personal/standard-character-pinyin.json", "utf8"),
);
const runtime = JSON.parse(
  await readFile("src/data/curated/standard-character-pinyin.json", "utf8"),
);
const standard = JSON.parse(
  await readFile("src/data/curated/standard-characters.json", "utf8"),
);
const failures = [];
const standardCharacters = [...standard.characters];
const standardSet = new Set(standardCharacters);
const indexedCharacters = Object.keys(source.index);
const missingCharacters = standardCharacters.filter((char) => !source.index[char]);
const polyphonicCharacters = Object.fromEntries(
  Object.entries(source.index).filter(([, readings]) => readings.length > 1),
);

if (source.schemaVersion !== 1) failures.push("Unsupported source schema version");
if (source.manifest.checkedAt !== "2026-09-30") failures.push("Stale source check date");
if (indexedCharacters.some((char) => !standardSet.has(char)))
  failures.push("Index contains non-standard characters");
if (JSON.stringify(source.missingCharacters) !== JSON.stringify(missingCharacters))
  failures.push("Missing-character audit mismatch");
if (JSON.stringify(source.polyphonicCharacters) !== JSON.stringify(polyphonicCharacters))
  failures.push("Polyphonic-character audit mismatch");
if (
  indexedCharacters.some((char) => {
    const readings = source.index[char];
    return (
      !Array.isArray(readings) ||
      !readings.length ||
      readings.some((reading) => !reading || reading !== reading.normalize("NFC")) ||
      new Set(readings).size !== readings.length
    );
  })
)
  failures.push("Invalid or duplicate pinyin readings");

const counts = {
  standardCharacters: standardCharacters.length,
  coveredCharacters: indexedCharacters.length,
  missingCharacters: missingCharacters.length,
  polyphonicCharacters: Object.keys(polyphonicCharacters).length,
};
const content = {
  index: source.index,
  missingCharacters: source.missingCharacters,
  polyphonicCharacters: source.polyphonicCharacters,
};
if (JSON.stringify(source.manifest.counts) !== JSON.stringify(counts))
  failures.push("Source count metadata mismatch");
if (source.manifest.indexSha256 !== hash(source.index))
  failures.push("Source index hash mismatch");
if (source.manifest.contentSha256 !== hash(content))
  failures.push("Source content hash mismatch");
if (
  runtime.schemaVersion !== source.schemaVersion ||
  runtime.manifest.version !== source.manifest.version ||
  runtime.manifest.checkedAt !== source.manifest.checkedAt ||
  runtime.manifest.indexSha256 !== source.manifest.indexSha256 ||
  runtime.manifest.sourceContentSha256 !== source.manifest.contentSha256 ||
  JSON.stringify(runtime.manifest.counts) !== JSON.stringify(counts) ||
  JSON.stringify(runtime.index) !== JSON.stringify(source.index)
)
  failures.push("Runtime pinyin asset is not derived from the committed SSOT");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Standard pinyin audit passed: ${counts.coveredCharacters}/${counts.standardCharacters} covered, ${counts.missingCharacters} missing, ${counts.polyphonicCharacters} polyphonic.`,
  );
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
