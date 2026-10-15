import { mkdir, writeFile } from "node:fs/promises";
import { loadSelectedRuntimeBundle } from "../data/runtimeBundleSelection";
import { namingProfileSchema } from "../../src/domain/project/profile";
import { evaluateCandidateRules } from "../../src/domain/rules/rulePack";
import { generateCandidates } from "../../src/domain/generation/generateCandidates";
import corpusTargets from "../../data/sources/personal/corpus-targets.json";
const bundle = loadSelectedRuntimeBundle();
const combinations = bundle.modernCombinations ?? [];
const characterMap = new Map(bundle.characters.map((item) => [item.char, item]));
const profile = namingProfileSchema.parse({
  projectId: "quality",
  surname: "宋",
  surnameType: "single",
  givenNameLength: 2,
  requiredCharacters: [],
  generationCharacters: [],
  avoidCharacters: [],
  relativeNames: [],
  forbiddenCombinations: [],
  genderExpression: "unrestricted",
  styleTags: [],
  writingComplexity: "balanced",
  pinyinFriendly: false,
  folklore: { enabled: false, usefulElements: [], includeInRanking: false },
});
const failures: string[] = [];
if (
  combinations.length !== corpusTargets.modernCombinations ||
  new Set(combinations.map((item) => item.givenName)).size !== corpusTargets.modernCombinations
)
  failures.push(`需要恰好${corpusTargets.modernCombinations}个不重复组合`);
const allusionNames = new Set(bundle.allusions.map((item) => item.selectedText));
for (const item of combinations) {
  const result = evaluateCandidateRules({
    candidate: {
      fullName: `宋${item.givenName}`,
      givenName: item.givenName,
      riskSignals: [...item.givenName].flatMap(
        (char) => characterMap.get(char)?.riskSignals ?? [],
      ),
    },
    profile,
    bundle,
  });
  if (!result.accepted || allusionNames.has(item.givenName)) failures.push(item.givenName);
}
// Exercise the actual generator across the complete collection, one constrained name at a time.
for (const item of combinations) {
  const result = generateCandidates({
    profile: {
      ...profile,
      requiredCharacters: [
        { char: item.givenName[0]!, position: 1 },
        { char: item.givenName[1]!, position: 2 },
      ],
    },
    bundle,
    seed: `qa:${item.givenName}`,
    requestedCount: 1,
    allusionRatio: 0,
    historicalFingerprints: new Set(),
  });
  const generated = result.candidates[0];
  if (
    result.candidates.length !== 1 ||
    generated?.givenName !== item.givenName ||
    generated.summary !== item.meaning ||
    !generated.sourceEvidence.some(
      (source) =>
        source.sourceId === "erya-modern-20260927" && source.excerpt === item.usageNote,
    )
  )
    failures.push(`生成/解释不一致:${item.givenName}`);
}
const count = (values: string[]) =>
  Object.fromEntries(
    [...new Set(values)]
      .sort()
      .map((value) => [value, values.filter((item) => item === value).length]),
  );
const report = {
  dataset: bundle.manifest.version,
  total: combinations.length,
  unique: new Set(combinations.map((item) => item.givenName)).size,
  characters: new Set(combinations.flatMap((item) => [...item.givenName])).size,
  styles: count(combinations.flatMap((item) => item.styleTags)),
  expressions: count(combinations.map((item) => item.genderExpression)),
  generatedAndChecked: combinations.length,
  failures,
  checkedAt: new Date().toISOString(),
  reviewMethod: "AI编辑；规范字、引用边界与全量生成自动校验，不代表专家逐条人审",
};
await mkdir("output/quality", { recursive: true });
await writeFile(
  "output/quality/modern-combinations.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
