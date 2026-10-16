import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import devBundle from "../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../src/data/schema/runtimeBundle";
import type { GenerationRepository } from "../../src/application/ports/GenerationRepository";
import { GenerateCandidateBatch } from "../../src/application/use-cases/GenerateCandidateBatch";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";

const databaseNames = new Set<string>();
const bundle = runtimeBundleSchema.parse(devBundle);
const createdAt = "2026-10-16T01:00:00.000Z";

function createDatabase(): EryaDatabase {
  const name = `erya-generation-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

async function seedProject(
  database: EryaDatabase,
  profile = namingProfileFixture("project-song"),
): Promise<void> {
  const result = await new DexieProjectRepository(database).create({
    project: {
      id: profile.projectId,
      title: "宋姓宝宝起名",
      stage: "naming",
      status: "active",
      createdAt,
      updatedAt: createdAt,
    },
    profile,
  });
  if (!result.ok) throw new Error(result.error);
}

function createUseCase(database: EryaDatabase, generations?: GenerationRepository) {
  return new GenerateCandidateBatch(
    new DexieProjectRepository(database),
    generations ?? new DexieGenerationRepository(database),
    {
      loadBundle: () => bundle,
      createBatchId: () => crypto.randomUUID(),
      createCandidateId: (fullName) => `candidate:${crypto.randomUUID()}:${fullName}`,
      now: () => createdAt,
      analyzeCurrentRevision: async () => ({ status: "completed", runId: "run-test" }),
    },
  );
}

describe("GenerateCandidateBatch", () => {
  it("persists v2 candidate facts, separate sources, and inspiration-pool decisions", async () => {
    const database = createDatabase();
    const profile = {
      ...namingProfileFixture(),
      basics: {
        ...namingProfileFixture().basics,
        styleTags: ["清朗自然", "文雅书卷"],
        pinyinFriendly: true,
      },
    };
    await seedProject(database, profile);

    const generated = await createUseCase(database).execute({
      projectId: profile.projectId,
      requestedCount: 12,
      allusionRatio: 0.5,
      seed: "song-batch-1",
    });

    expect(generated.ok).toBe(true);
    expect(generated.ok && generated.value.candidateIds).toHaveLength(12);
    expect(await database.generationBatches.count()).toBe(1);
    expect((await database.generationBatches.toArray())[0]?.inspirationSources).toEqual([
      "poetry",
      "modern",
    ]);
    expect(await database.candidates.count()).toBe(12);
    expect(await database.candidateSources.count()).toBeGreaterThan(0);
    expect(await database.ruleEvidence.count()).toBe(0);
    expect(await database.candidateScores.count()).toBe(0);

    const candidate = (await database.candidates.toArray())[0];
    expect(candidate).toBeDefined();
    expect(candidate).not.toHaveProperty("ruleResults");
    expect(candidate).not.toHaveProperty("systemScore");
    expect(candidate).not.toHaveProperty("sourceEvidence");
    expect(
      await database.candidateDecisions
        .where("[projectId+pool]")
        .equals([profile.projectId, "inspiration"])
        .count(),
    ).toBe(12);

    const listed = await new DexieGenerationRepository(database).listCandidates(
      profile.projectId,
      ["inspiration"],
    );
    expect(listed).toHaveLength(12);
    expect(listed.some((item) => item.sources.some((source) => source.quote))).toBe(true);
    database.close();
  });

  it("uses profile.inspiration.sources and keeps historical inspiration traceable", async () => {
    const database = createDatabase();
    const profile = {
      ...namingProfileFixture(),
      inspiration: { sources: ["historical"] as ["historical"] },
    };
    await seedProject(database, profile);

    const generated = await createUseCase(database).execute({
      projectId: profile.projectId,
      requestedCount: 3,
      allusionRatio: 0.5,
      seed: "historical-only",
    });

    expect(generated.ok).toBe(true);
    expect((await database.generationBatches.toArray())[0]?.inspirationSources).toEqual([
      "historical",
    ]);
    expect(
      (await database.candidates.toArray()).every(
        (item) => item.sourceType === "historical_inspiration",
      ),
    ).toBe(true);
    expect(
      (await database.candidateSources.toArray()).every((source) =>
        source.excerpt?.includes("关系："),
      ),
    ).toBe(true);
    database.close();
  });

  it("rejects a stale duplicate fingerprint without partially writing a batch", async () => {
    const database = createDatabase();
    await seedProject(database);
    const repository = new DexieGenerationRepository(database);
    const staleRepository: GenerationRepository = {
      findHistoricalFingerprints: async () => new Set(),
      countBatches: repository.countBatches.bind(repository),
      listCandidates: repository.listCandidates.bind(repository),
      saveCompletedBatch: repository.saveCompletedBatch.bind(repository),
    };
    const first = createUseCase(database, staleRepository);
    const second = createUseCase(database, staleRepository);
    const input = {
      projectId: "project-song",
      requestedCount: 3,
      allusionRatio: 0.5,
      seed: "same-stale-generation",
    };

    expect((await first.execute(input)).ok).toBe(true);
    const secondResult = await second.execute(input);
    expect(secondResult).toEqual(
      expect.objectContaining({ ok: false, error: expect.stringContaining("同名结果") }),
    );
    expect(await database.generationBatches.count()).toBe(1);
    expect(await database.candidates.count()).toBe(3);
    expect(await database.candidateDecisions.count()).toBe(3);
    database.close();
  });

  it("keeps a completed audit batch when every matching candidate is hard rejected", async () => {
    const database = createDatabase();
    const profile = {
      ...namingProfileFixture(),
      family: {
        ...namingProfileFixture().family,
        requiredCharacters: [{ char: "安", position: 2 as const }],
      },
    };
    await seedProject(database, profile);
    const rejectingBundle = {
      ...bundle,
      characters: bundle.characters.map((entry) =>
        entry.char === "安"
          ? {
              ...entry,
              riskSignals: [
                {
                  kind: "known_homophone" as const,
                  outcome: "reject" as const,
                  explanation: "测试用已复核严重谐音风险",
                  sourceRefs: ["test-review"],
                  reviewStatus: "verified" as const,
                },
              ],
            }
          : entry,
      ),
    };
    const result = await new GenerateCandidateBatch(
      new DexieProjectRepository(database),
      new DexieGenerationRepository(database),
      {
        loadBundle: () => rejectingBundle,
        createBatchId: () => "batch-rejected",
        createCandidateId: (fullName) => `candidate-rejected:${fullName}`,
        now: () => createdAt,
        analyzeCurrentRevision: async () => ({ status: "completed", runId: "run-test" }),
      },
    ).execute({
      projectId: profile.projectId,
      requestedCount: 100,
      allusionRatio: 0.5,
      seed: "reject-all-matching",
    });

    expect(result.ok).toBe(true);
    expect(await database.candidates.count()).toBe(0);
    expect(
      (await database.generationBatches.get("batch-rejected"))?.statistics.hardRejected,
    ).toBeGreaterThan(0);
    database.close();
  });
});
