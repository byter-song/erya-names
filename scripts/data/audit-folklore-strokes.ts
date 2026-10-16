import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

type StrokeRecord = {
  character: string;
  roles: ("given_name" | "surname")[];
  reviewStatus: "research_only" | "reviewed";
  kangxiForm: string | null;
  strokeCount: number | null;
};

const root = new URL("../../data/sources/personal/", import.meta.url);
const folklore = new URL("folklore/", root);
const readText = async (url: URL) => readFile(url, "utf8");
const readJson = async <T>(url: URL) => JSON.parse(await readText(url)) as T;
const digest = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

const givenNameCharacters = (await readText(new URL("characters.tsv", root)))
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => line.split("\t", 1)[0]!);

const surnameSource = await readText(
  new URL("../../src/domain/candidate/nameReading.ts", import.meta.url),
);
const surnameBlock = surnameSource.split("const surnameReadings:")[1]?.split("};", 1)[0] ?? "";
const supportedSurnames = [...surnameBlock.matchAll(/^\s{2}([^:]+):/gmu)].map((match) =>
  match[1]!.trim(),
);
const surnameCharacters = [...new Set(supportedSurnames.flatMap((surname) => [...surname]))];

const strokeText = await readText(new URL("strokes/characters.json", folklore));
const strokePack = JSON.parse(strokeText) as {
  supportedSurnames: string[];
  characters: StrokeRecord[];
};
const strokeRules = await readJson<{ characterDataChecksum: string }>(
  new URL("strokes/rules.json", folklore),
);
const coverage = await readJson<{
  generatedGivenNameCharacters: {
    expected: number;
    recorded: number;
    inventoryCoveragePercent: number;
  };
  supportedSurnames: {
    entries: number;
    uniqueCharacters: number;
    recorded: number;
    inventoryCoveragePercent: number;
  };
  review: { reviewedCharacters: number; usableStrokeCoveragePercent: number };
}>(new URL("strokes/coverage-report.json", folklore));
const fiveGridRules = await readJson<{
  numberMeanings: { value: number; reviewStatus: string }[];
}>(new URL("five-grids/rules.json", folklore));

const errors: string[] = [];
const byCharacter = new Map(strokePack.characters.map((record) => [record.character, record]));

for (const character of [...givenNameCharacters, ...surnameCharacters]) {
  if (!byCharacter.has(character)) errors.push(`Missing tracked stroke record: ${character}`);
}
if (new Set(givenNameCharacters).size !== 303)
  errors.push("Expected exactly 303 generated-name characters.");
if (new Set(strokePack.supportedSurnames).size !== supportedSurnames.length) {
  errors.push("Supported surname inventory is missing entries or contains duplicates.");
}
if (supportedSurnames.some((surname) => !strokePack.supportedSurnames.includes(surname))) {
  errors.push("Stroke pack does not match the supported surname registry.");
}
for (const record of strokePack.characters) {
  if (
    record.reviewStatus !== "reviewed" &&
    (record.kangxiForm !== null || record.strokeCount !== null)
  ) {
    errors.push(
      `Unreviewed record claims an adopted Kangxi form or stroke count: ${record.character}`,
    );
  }
}

const reviewedCount = strokePack.characters.filter(
  (record) => record.reviewStatus === "reviewed",
).length;
if (
  coverage.generatedGivenNameCharacters.expected !== 303 ||
  coverage.generatedGivenNameCharacters.recorded !== 303 ||
  coverage.generatedGivenNameCharacters.inventoryCoveragePercent !== 100
) {
  errors.push("Generated-name inventory coverage report is not 303/303 (100%).");
}
if (
  coverage.supportedSurnames.entries !== supportedSurnames.length ||
  coverage.supportedSurnames.uniqueCharacters !== surnameCharacters.length ||
  coverage.supportedSurnames.recorded !== surnameCharacters.length ||
  coverage.supportedSurnames.inventoryCoveragePercent !== 100
) {
  errors.push("Supported-surname inventory coverage report does not match the registry.");
}
if (coverage.review.reviewedCharacters !== reviewedCount)
  errors.push("Reviewed stroke count is stale.");
if (coverage.review.usableStrokeCoveragePercent !== 0 || reviewedCount !== 0) {
  errors.push(
    "The initial pack must not claim usable Kangxi stroke coverage before image review.",
  );
}
if (strokeRules.characterDataChecksum !== digest(strokeText)) {
  errors.push("Stroke rules do not pin the characters.json checksum.");
}

if (
  fiveGridRules.numberMeanings.length !== 81 ||
  fiveGridRules.numberMeanings.some((record, index) => record.value !== index + 1)
) {
  errors.push("Five-grid pack must track every number from 1 through 81 exactly once.");
}
if (fiveGridRules.numberMeanings.some((record) => record.reviewStatus !== "research_only")) {
  errors.push("Unverified 81-number records must remain research_only.");
}

for (const [directory, payload] of [
  ["hexagram", "rules.json"],
  ["five-grids", "rules.json"],
  ["strokes", "rules.json"],
] as const) {
  const manifest = await readJson<{ checksum: string }>(
    new URL(`${directory}/manifest.json`, folklore),
  );
  const payloadText = await readText(new URL(`${directory}/${payload}`, folklore));
  if (manifest.checksum !== digest(payloadText))
    errors.push(`${directory} manifest checksum does not match payload.`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        ok: true,
        generatedNameCharacters: givenNameCharacters.length,
        supportedSurnameEntries: supportedSurnames.length,
        supportedSurnameCharacters: surnameCharacters.length,
        trackedUniqueCharacters: strokePack.characters.length,
        reviewedCharacters: reviewedCount,
        numberMeaningsTracked: fiveGridRules.numberMeanings.length,
      },
      null,
      2,
    ),
  );
}
