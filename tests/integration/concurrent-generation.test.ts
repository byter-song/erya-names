import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import devBundle from "../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../src/data/schema/runtimeBundle";
import { namingProfileSchema } from "../../src/domain/project/profile";
import { generationBatchSchema } from "../../src/domain/generation/batch";
import { generateCandidates } from "../../src/domain/generation/generateCandidates";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";
it("atomically refuses a second tab's stale batch instead of saving duplicate names", async () => {
  const database = new EryaDatabase(`erya-concurrent-${crypto.randomUUID()}`);
  try {
    const profile = namingProfileSchema.parse(namingProfileFixture("p"));
    const bundle = runtimeBundleSchema.parse(devBundle);
    const generated = generateCandidates({
      profile,
      bundle,
      seed: "same-history",
      requestedCount: 12,
      allusionRatio: 0.5,
      historicalFingerprints: new Set(),
    });
    const repository = new DexieGenerationRepository(database);
    const makeBatch = (id: string) => ({
      batch: generationBatchSchema.parse({
        id,
        projectId: "p",
        sequence: 1,
        seed: "same-history",
        requestedCount: 12,
        profileSnapshot: profile,
        datasetVersion: bundle.manifest.version,
        rulePackVersion: "core-rules-2",
        status: "completed",
        statistics: generated.statistics,
        createdAt: "2026-09-27T00:00:00.000Z",
      }),
      candidates: generated.candidates.map((candidate) => ({
        ...candidate,
        id: `${id}:${candidate.fullName}`,
        batchId: id,
        createdAt: "2026-09-27T00:00:00.000Z",
      })),
    });
    const outcomes = await Promise.allSettled([
      repository.saveCompletedBatch(makeBatch("first-tab")),
      repository.saveCompletedBatch(makeBatch("second-tab")),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(await database.generationBatches.count()).toBe(1);
    expect(await database.candidates.count()).toBe(12);
    expect(await database.candidateDecisions.count()).toBe(12);
  } finally {
    await database.delete();
  }
});
