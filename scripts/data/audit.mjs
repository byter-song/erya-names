import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const read = (path) =>
  JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const bundle = read("src/data/curated/personal-bundle.json");
const corpusTargets = read("data/sources/personal/corpus-targets.json");
const standard = new Set(read("src/data/curated/standard-characters.json").characters);
const {
  characters,
  allusions,
  modernCombinations,
  standardCharacterPinyin = {},
  traditionalToSimplified = {},
  personUsages = [],
} = bundle;
const failures = [];
const hash = createHash("sha256")
  .update(
    JSON.stringify({
      characters,
      allusions,
      ...(modernCombinations ? { modernCombinations } : {}),
      ...(Object.keys(standardCharacterPinyin).length ? { standardCharacterPinyin } : {}),
      ...(Object.keys(traditionalToSimplified).length ? { traditionalToSimplified } : {}),
      ...(personUsages.length ? { personUsages } : {}),
    }),
  )
  .digest("hex");
if (hash !== bundle.manifest.contentHash) failures.push("Personal bundle hash mismatch");
if (bundle.manifest.status !== "personal") failures.push("Personal bundle status mismatch");
if (new Set(characters.map((x) => x.char)).size !== characters.length)
  failures.push("Duplicate characters");
if (
  Object.keys(standardCharacterPinyin).length !== 8105 ||
  characters.some((entry) => !standardCharacterPinyin[entry.char]?.length)
)
  failures.push("Standard-character pinyin index is incomplete");
for (const char of characters) {
  if (
    !standard.has(char.char) ||
    !char.sourceRefs.some((x) => x.sourceId === "standard-hanzi-2013") ||
    !char.pinyin.length ||
    !char.meanings.length ||
    !char.strokes ||
    !char.element ||
    !char.elementReason ||
    !char.elementEvidence ||
    char.elementEvidence.reviewStatus !== "source_checked" ||
    !char.elementEvidence.sourceRefs?.length
  )
    failures.push(`Incomplete character ${char.char}`);
  if (char.reviewStatus !== "source_checked" || !char.checkedAt)
    failures.push(`Review provenance missing ${char.char}`);
  for (const value of [char.char, ...char.meanings, ...char.risks])
    if (simplify(value) !== value)
      failures.push(`Traditional character-card display text ${char.char}: ${value}`);
}
if (modernCombinations) {
  const chars = new Set(characters.map((item) => item.char));
  if (
    modernCombinations.length !== corpusTargets.modernCombinations ||
    new Set(modernCombinations.map((item) => item.givenName)).size !==
      corpusTargets.modernCombinations
  )
    failures.push(
      `Modern collection must contain ${corpusTargets.modernCombinations} unique names`,
    );
  for (const item of modernCombinations)
    if (
      [...item.givenName].length !== 2 ||
      [...item.givenName].some((char) => !chars.has(char)) ||
      !item.meaning ||
      !item.usageNote
    )
      failures.push(`Invalid combination ${item.givenName}`);
    else
      for (const value of [item.givenName, item.meaning, item.usageNote])
        if (simplify(value) !== value)
          failures.push(`Traditional modern-combination display text ${item.givenName}`);
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
  for (const value of [
    item.title,
    item.work,
    item.quote,
    item.selectedText,
    item.interpretation,
    ...item.risks,
    ...item.sourceRefs.flatMap((source) => [source.location, source.excerpt ?? ""]),
  ])
    if (simplify(value) !== value)
      failures.push(`Traditional display text ${item.id}: ${value}`);
}
const personIds = personUsages.map((usage) => usage.id);
const zhuangyuan = personUsages.filter((usage) => usage.identityType === "zhuangyuan");
if (new Set(personIds).size !== personIds.length) failures.push("Duplicate person usage ids");
if (zhuangyuan.length !== corpusTargets.zhuangyuan)
  failures.push(`Expected ${corpusTargets.zhuangyuan} zhuangyuan records`);
const modernNames = modernCombinations?.map((item) => item.givenName) ?? [];
const characterSet = new Set(characters.map((item) => item.char));
const reviewedInspirationZhuangyuan = zhuangyuan.filter(
  (usage) =>
    typeof usage.inspirationEligible === "boolean" && usage.inspirationCharacters?.length,
);
if (reviewedInspirationZhuangyuan.length !== zhuangyuan.length)
  failures.push("Every zhuangyuan record must declare inspiration eligibility and characters");
const eligibleInspirationZhuangyuan = reviewedInspirationZhuangyuan.filter(
  (usage) => usage.inspirationEligible,
);
const generatableZhuangyuan = eligibleInspirationZhuangyuan.filter((usage) => {
  const usable = usage.inspirationCharacters
    .map(simplify)
    .filter((char) => characterSet.has(char));
  return (
    usable.length > 0 &&
    (usable.length === 2 ||
      modernNames.some((name) => usable.some((char) => name.includes(char))))
  );
});
if (
  reviewedInspirationZhuangyuan.length > 0 &&
  generatableZhuangyuan.length / eligibleInspirationZhuangyuan.length <
    corpusTargets.minimumGeneratableNewZhuangyuanRatio
)
  failures.push(
    `Generatable zhuangyuan ratio ${generatableZhuangyuan.length}/${eligibleInspirationZhuangyuan.length} is below ${corpusTargets.minimumGeneratableNewZhuangyuanRatio}`,
  );
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
  for (const value of [
    usage.name,
    usage.period,
    usage.description,
    usage.rankEvidence ?? "",
    ...usage.sourceRefs.map((source) => source.location),
  ])
    if (simplify(value) !== value)
      failures.push(`Traditional person-usage display text ${usage.id}: ${value}`);
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

function simplify(value) {
  // 乾 is retained in the proper era name 乾隆; character-by-character OpenCC-style
  // conversion would incorrectly turn it into 干隆.
  const protectedValue = value.normalize("NFC").replaceAll("乾隆", "QIANLONG_ERA");
  return [...protectedValue]
    .map((char) => traditionalToSimplified[char] ?? char)
    .join("")
    .replaceAll("QIANLONG_ERA", "乾隆");
}
