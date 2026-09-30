import { readFile, writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import scenarios from "../../tests/fixtures/generation-scenarios.json";
import { runtimeBundleSchema } from "../../src/data/schema/runtimeBundle";
import { namingProfileSchema } from "../../src/domain/project/profile";
import { generateCandidates } from "../../src/domain/generation/generateCandidates";

const bundlePath = process.argv[2] ?? "src/data/curated/releases/current.json";
let rawBundle: string;
try {
  rawBundle = await readFile(bundlePath, "utf8");
} catch (error) {
  const report = {
    status: "blocked",
    bundlePath,
    reason:
      error instanceof Error && "code" in error && error.code === "ENOENT"
        ? "production-bundle-missing"
        : "production-bundle-unreadable",
  };
  await mkdir("data/audit", { recursive: true });
  await writeFile(
    "data/audit/generation-report.json",
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(1);
}
const bundle = runtimeBundleSchema.parse(JSON.parse(rawBundle));
if (bundle.manifest.status !== "production")
  throw new Error("Generation release benchmark requires a production bundle");
const samples: number[] = [];
const results = [];
for (const scenario of scenarios) {
  const profile = namingProfileSchema.parse({
    projectId: `project-${scenario.id}`,
    surname: scenario.surname,
    surnameType: "single",
    givenNameLength: 2,
    requiredCharacters: [],
    generationCharacters: [],
    avoidCharacters: [],
    relativeNames: [],
    forbiddenCombinations: [],
    genderExpression: "unrestricted",
    styleTags: scenario.styleTags,
    writingComplexity: "balanced",
    pinyinFriendly: true,
    folklore: { enabled: false, usefulElements: [], includeInRanking: false },
  });
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const started = performance.now();
    const generated = generateCandidates({
      profile,
      bundle,
      seed: `${scenario.id}:${iteration}`,
      requestedCount: 20,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(),
    });
    samples.push(performance.now() - started);
    if (generated.candidates.length < 20)
      throw new Error(`${scenario.id}: fewer than 20 candidates`);
    if (generated.candidates.some((candidate) => candidate.sourceEvidence.length === 0))
      throw new Error(`${scenario.id}: incomplete source evidence`);
  }
  results.push({ scenario: scenario.id, runs: 20 });
}
samples.sort((left, right) => left - right);
const percentile = (value: number) =>
  samples[Math.min(samples.length - 1, Math.ceil(samples.length * value) - 1)] ?? 0;
const report = {
  bundleVersion: bundle.manifest.version,
  runs: samples.length,
  p50Ms: percentile(0.5),
  p95Ms: percentile(0.95),
  scenarios: results,
};
if (report.p95Ms > 2000) throw new Error(`Generation P95 ${report.p95Ms}ms exceeds 2000ms`);
await mkdir("data/audit", { recursive: true });
await writeFile(
  "data/audit/generation-report.json",
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(report, null, 2));
