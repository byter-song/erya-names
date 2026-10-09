import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import devBundle from "../../src/data/curated/dev-bundle.json";
import { runtimeBundleSchema } from "../../src/data/schema/runtimeBundle";
import { CreateNamingProject } from "../../src/application/use-cases/CreateNamingProject";
import { GenerateCandidateBatch } from "../../src/application/use-cases/GenerateCandidateBatch";
import { MoveCandidateDecision } from "../../src/application/use-cases/MoveCandidateDecision";
import { UpdateNamingProfile } from "../../src/application/use-cases/UpdateNamingProfile";
import { UpdateFolkloreReviewSettings } from "../../src/application/use-cases/UpdateFolkloreReviewSettings";
import { GetCandidateFunnel } from "../../src/application/use-cases/GetCandidateFunnel";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieDecisionRepository } from "../../src/infrastructure/repositories/DexieDecisionRepository";
import { DexieGenerationRepository } from "../../src/infrastructure/repositories/DexieGenerationRepository";
import { DexieProjectRepository } from "../../src/infrastructure/repositories/DexieProjectRepository";

const databaseNames = new Set<string>();
const bundle = runtimeBundleSchema.parse(devBundle);

function createDatabase(): EryaDatabase {
  const name = `erya-generation-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

async function createSongProject(database: EryaDatabase): Promise<void> {
  const projects = new DexieProjectRepository(database);
  await new CreateNamingProject(projects, {
    createId: () => "project-song",
    now: () => "2026-09-17T00:00:00.000Z",
  }).execute({
    title: "宋姓宝宝起名",
    surname: "宋",
    surnameType: "single",
    givenNameLength: 2,
  });
  await new UpdateNamingProfile(projects, { now: () => "2026-09-17T00:10:00.000Z" }).execute({
    projectId: "project-song",
    patch: { styleTags: ["清朗自然", "文雅书卷"] },
    completeOnboarding: true,
  });
}

describe("GenerateCandidateBatch", () => {
  it("atomically persists a generated batch with candidate evidence and inbox decisions", async () => {
    const database = createDatabase();
    await createSongProject(database);
    const useCase = new GenerateCandidateBatch(
      new DexieProjectRepository(database),
      new DexieGenerationRepository(database),
      {
        loadBundle: () => bundle,
        createBatchId: () => "batch-1",
        createCandidateId: (fullName) => `candidate:${fullName}`,
        now: () => "2026-09-17T01:00:00.000Z",
      },
    );

    const generated = await useCase.execute({
      projectId: "project-song",
      requestedCount: 12,
      allusionRatio: 0.5,
      seed: "song-batch-1",
    });

    expect(generated.ok).toBe(true);
    expect(generated.ok && generated.value.candidateIds).toHaveLength(12);
    expect(await database.generationBatches.count()).toBe(1);
    expect(await database.candidates.count()).toBe(12);
    expect(await database.candidateSources.count()).toBeGreaterThan(0);
    expect(
      (await database.candidateSources.toArray()).some(
        (source) => typeof source.quote === "string" && source.quote.length > 0,
      ),
    ).toBe(true);
    expect(await database.ruleResults.count()).toBeGreaterThan(0);
    expect(await database.ruleResults.where("outcome").equals("reject").count()).toBe(0);
    expect(
      (await database.ruleResults.toArray()).filter(
        (result) => result.ruleId === "l1-standard-character",
      ),
    ).toHaveLength(12);
    const l3Rules = (await database.ruleResults.toArray()).filter(
      (result) => result.evidenceLevel === "L3",
    );
    expect(l3Rules.some((result) => result.ruleId === "l3-style-match")).toBe(true);
    expect(
      l3Rules.filter((result) => result.ruleId === "l3-score-base" && result.scoreDelta === 60),
    ).toHaveLength(12);
    expect(l3Rules.some((result) => result.ruleId === "l3-shape-balance")).toBe(true);
    expect(l3Rules.find((result) => result.ruleId === "l3-shape-balance")?.outcome).toBe(
      "unknown",
    );
    expect(
      l3Rules.every((result) =>
        ["system-score-1", "preference-score-3"].includes(result.ruleVersion),
      ),
    ).toBe(true);
    expect(
      await database.candidateDecisions
        .where("[projectId+stage]")
        .equals(["project-song", "inbox"])
        .count(),
    ).toBe(12);
    database.close();
  });

  it("calculates L4 only after names enter folklore review and keeps the base score stable", async () => {
    const database = createDatabase();
    await createSongProject(database);
    const updated = await new UpdateNamingProfile(new DexieProjectRepository(database), {
      now: () => "2026-09-17T00:20:00.000Z",
    }).execute({
      projectId: "project-song",
      patch: {
        folklore: {
          enabled: true,
          birthLocalDateTime: "2024-02-10T12:00",
          timeZone: "Asia/Shanghai",
          usefulElements: ["water"],
          includeInRanking: true,
        },
      },
      completeOnboarding: true,
    });
    expect(updated.ok).toBe(true);
    const generations = new DexieGenerationRepository(database);
    const generated = await new GenerateCandidateBatch(
      new DexieProjectRepository(database),
      generations,
      {
        loadBundle: () => bundle,
        createBatchId: () => "batch-folklore",
        createCandidateId: (fullName) => `candidate-folklore:${fullName}`,
        now: () => "2026-09-17T01:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      requestedCount: 3,
      allusionRatio: 0.5,
      seed: "folklore",
    });
    if (!generated.ok) throw new Error(generated.error);

    expect(
      (await database.ruleResults.toArray()).filter((result) => result.evidenceLevel === "L4"),
    ).toHaveLength(0);
    const before = await new GetCandidateFunnel(generations).execute("project-song");
    const decisions = new DexieDecisionRepository(database);
    const move = new MoveCandidateDecision(decisions, {
      now: () => "2026-09-17T01:10:00.000Z",
      canProgress: async () => true,
    });
    for (const candidateId of generated.value.candidateIds.slice(0, 2)) {
      await move.execute({ projectId: "project-song", candidateId, to: "basic_shortlist" });
      await move.execute({ projectId: "project-song", candidateId, to: "folklore_review" });
    }

    const reviewed = await new UpdateFolkloreReviewSettings(
      new DexieProjectRepository(database),
      generations,
      { now: () => "2026-09-17T01:20:00.000Z" },
    ).execute({
      projectId: "project-song",
      folklore: {
        enabled: true,
        birthLocalDateTime: "2024-02-10T12:00",
        timeZone: "Asia/Shanghai",
        usefulElements: ["water"],
        includeInRanking: true,
      },
    });
    expect(reviewed.ok).toBe(true);

    const l4 = (await database.ruleResults.toArray()).filter(
      (result) => result.evidenceLevel === "L4",
    );
    expect(l4).toHaveLength(2);
    expect(
      (await database.candidates.toArray()).filter((candidate) =>
        candidate.ruleResults.some((result) => result.evidenceLevel === "L4"),
      ),
    ).toHaveLength(2);
    const after = await new GetCandidateFunnel(generations).execute("project-song");
    expect(after.map((candidate) => candidate.systemScore)).toEqual(
      before.map((candidate) => candidate.systemScore),
    );
    database.close();
  });

  it("persists a favorite decision after reopening the same database", async () => {
    const database = createDatabase();
    await createSongProject(database);
    const generated = await new GenerateCandidateBatch(
      new DexieProjectRepository(database),
      new DexieGenerationRepository(database),
      {
        loadBundle: () => bundle,
        createBatchId: () => "batch-1",
        createCandidateId: (fullName) => `candidate:${fullName}`,
        now: () => "2026-09-17T01:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      requestedCount: 12,
      allusionRatio: 0.5,
      seed: "song-batch-1",
    });
    if (!generated.ok) throw new Error(generated.error);
    const candidateId = generated.value.candidateIds[0];
    if (!candidateId) throw new Error("Expected a generated candidate");

    await new MoveCandidateDecision(new DexieDecisionRepository(database), {
      now: () => "2026-09-17T01:10:00.000Z",
      canProgress: async () => true,
    }).execute({ projectId: "project-song", candidateId, to: "favorite" });
    const name = database.name;
    database.close();

    const reopened = new EryaDatabase(name);
    const decision = await reopened.candidateDecisions.get(candidateId);
    expect(decision?.stage).toBe("favorite");
    reopened.close();
  });

  it("persists reviewed L2 warnings and returns them to the candidate funnel", async () => {
    const database = createDatabase();
    await createSongProject(database);
    const updated = await new UpdateNamingProfile(new DexieProjectRepository(database), {
      now: () => "2026-09-17T00:20:00.000Z",
    }).execute({
      projectId: "project-song",
      patch: { requiredCharacters: [{ char: "行", position: 2 }] },
      completeOnboarding: true,
    });
    expect(updated.ok).toBe(true);
    const repository = new DexieGenerationRepository(database);
    const generated = await new GenerateCandidateBatch(
      new DexieProjectRepository(database),
      repository,
      {
        loadBundle: () => bundle,
        createBatchId: () => "batch-risk",
        createCandidateId: (fullName) => `candidate-risk:${fullName}`,
        now: () => "2026-09-17T01:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      requestedCount: 6,
      allusionRatio: 0.5,
      seed: "song-risk",
    });

    expect(generated.ok).toBe(true);
    const candidates = await repository.listCandidates("project-song");
    expect(candidates).not.toHaveLength(0);
    expect(candidates.every((candidate) => candidate.warnings.length > 0)).toBe(true);
    expect(candidates.every((candidate) => candidate.scoreEvidence.length >= 5)).toBe(true);
    expect(
      candidates.every(
        (candidate) => candidate.systemScore >= 0 && candidate.systemScore <= 100,
      ),
    ).toBe(true);
    const warnedCandidateIds = new Set(
      (await database.ruleResults.toArray())
        .filter((result) => result.ruleId === "l2-multiple-pronunciation")
        .map((result) => result.candidateId),
    );
    expect(
      candidates.every((candidate) => warnedCandidateIds.has(candidate.candidate.id)),
    ).toBe(true);
    database.close();
  });

  it("persists only the batch statistics when every matching candidate is hard rejected", async () => {
    const database = createDatabase();
    await createSongProject(database);
    const updated = await new UpdateNamingProfile(new DexieProjectRepository(database), {
      now: () => "2026-09-17T00:20:00.000Z",
    }).execute({
      projectId: "project-song",
      patch: { requiredCharacters: [{ char: "安", position: 2 }] },
      completeOnboarding: true,
    });
    expect(updated.ok).toBe(true);
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
        now: () => "2026-09-17T01:00:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      requestedCount: 100,
      allusionRatio: 0.5,
      seed: "reject-all-matching",
    });

    expect(result.ok).toBe(true);
    expect(await database.candidates.count()).toBe(0);
    const batch = await database.generationBatches.get("batch-rejected");
    expect(
      (batch as { statistics?: { hardRejected?: number } })?.statistics?.hardRejected,
    ).toBeGreaterThan(0);
    database.close();
  });
});
