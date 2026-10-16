import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { ClearExcludedCandidates } from "../../src/application/use-cases/ClearExcludedCandidates";
import { RestoreExcludedCandidate } from "../../src/application/use-cases/RestoreExcludedCandidate";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieDecisionRepository } from "../../src/infrastructure/repositories/DexieDecisionRepository";

const databaseNames = new Set<string>();
const excludedAt = "2026-10-16T00:01:00.000Z";
const restoredAt = "2026-10-16T00:02:00.000Z";

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

function createDatabase(): { database: EryaDatabase; name: string } {
  const name = `erya-excluded-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return { database: new EryaDatabase(name), name };
}

async function seedCandidate(
  database: EryaDatabase,
  candidateId: string,
  options: { projectId?: string; pool?: "excluded" | "candidate" } = {},
): Promise<void> {
  const projectId = options.projectId ?? "p1";
  const pool = options.pool ?? "excluded";
  const ordinal = candidateId.replace(/\D/g, "") || candidateId;

  await database.candidates.add({
    id: candidateId,
    projectId,
    batchId: null,
    normalizedFingerprint: `${projectId}-宋清${ordinal}`,
    surname: "宋",
    givenName: `清${ordinal}`,
    fullName: `宋清${ordinal}`,
    pinyin: ["sòng", "qīng"],
    sourceType: "modern_combination",
    summary: "测试候选",
    createdAt: "2026-10-16T00:00:00.000Z",
  });
  await database.candidateSources.add({
    id: `source-${candidateId}`,
    projectId,
    candidateId,
    sourceId: `source-id-${candidateId}`,
    title: "测试来源",
  });
  await database.candidateDecisions.add(
    pool === "excluded"
      ? {
          candidateId,
          projectId,
          pool,
          lastActivePool: "selected",
          exclusionReason: "不符合当前偏好",
          excludedAt,
          updatedAt: excludedAt,
        }
      : {
          candidateId,
          projectId,
          pool,
          updatedAt: excludedAt,
        },
  );
  await database.candidateEvaluations.add({
    candidateId,
    projectId,
    rating: 3,
    note: "待讨论",
    updatedAt: excludedAt,
  });
  await database.ruleEvidence.add({
    id: `evidence-${candidateId}`,
    projectId,
    candidateId,
    moduleId: "basic",
    dimensionId: "meaning",
    ruleId: "basic-meaning",
    ruleVersion: "1",
    severity: "soft",
    status: "pass",
    applicability: "applied",
    scoreBefore: 100,
    deduction: 0,
    scoreAfter: 100,
    explanation: "字义无明显风险",
    inputSummary: `宋清${ordinal}`,
    inputHash: `hash-${candidateId}`,
    calculation: ["100 - 0 = 100"],
    sourceIds: [`source-id-${candidateId}`],
  });
  await database.candidateScores.add({
    candidateId,
    projectId,
    configRevision: 0,
    inputHash: `hash-${candidateId}`,
    hardStatus: "pass",
    totalScore: 100,
    completeness: 1,
    evaluatedDimensions: 1,
    expectedDimensions: 1,
    hiddenScoredModuleCount: 0,
    moduleScores: { basic: 100 },
    topDeductions: [],
  });
  await database.decisionHistory.add({
    projectId,
    candidateId,
    from: "selected",
    to: pool,
    action: pool === "excluded" ? "exclude" : "backward",
    ...(pool === "excluded" ? { exclusionReason: "不符合当前偏好" } : {}),
    changedAt: excludedAt,
  });
}

function createClear(database: EryaDatabase): ClearExcludedCandidates {
  return new ClearExcludedCandidates(new DexieDecisionRepository(database));
}

async function expectCandidateGraph(
  database: EryaDatabase,
  candidateId: string,
  present: boolean,
): Promise<void> {
  const expectedCount = present ? 1 : 0;
  const counts = await Promise.all([
    database.candidates.where("id").equals(candidateId).count(),
    database.candidateSources.where("candidateId").equals(candidateId).count(),
    database.candidateDecisions.where("candidateId").equals(candidateId).count(),
    database.candidateEvaluations.where("candidateId").equals(candidateId).count(),
    database.ruleEvidence.where("candidateId").equals(candidateId).count(),
    database.candidateScores.where("candidateId").equals(candidateId).count(),
    database.decisionHistory.where("candidateId").equals(candidateId).count(),
  ]);
  expect(counts).toEqual(Array.from({ length: counts.length }, () => expectedCount));
}

describe("ClearExcludedCandidates", () => {
  it("permanently clears only the checked excluded candidates and all candidate-owned rows", async () => {
    const { database } = createDatabase();
    await Promise.all(
      ["c1", "c2", "c3"].map((candidateId) => seedCandidate(database, candidateId)),
    );

    const result = await createClear(database).execute({
      projectId: "p1",
      selected: [
        { candidateId: "c1", expectedUpdatedAt: excludedAt },
        { candidateId: "c3", expectedUpdatedAt: excludedAt },
      ],
      confirmedCount: 2,
    });

    expect(result).toEqual({ ok: true, value: { deleted: 2 } });
    await expectCandidateGraph(database, "c1", false);
    await expectCandidateGraph(database, "c3", false);
    await expectCandidateGraph(database, "c2", true);
    database.close();
  });

  it("deletes nothing when the typed confirmation count differs from the checked count", async () => {
    const { database } = createDatabase();
    await Promise.all(["c1", "c2"].map((candidateId) => seedCandidate(database, candidateId)));

    const result = await createClear(database).execute({
      projectId: "p1",
      selected: [
        { candidateId: "c1", expectedUpdatedAt: excludedAt },
        { candidateId: "c2", expectedUpdatedAt: excludedAt },
      ],
      confirmedCount: 1,
    });

    expect(result).toEqual({ ok: false, error: "confirmation-count-mismatch" });
    await expectCandidateGraph(database, "c1", true);
    await expectCandidateGraph(database, "c2", true);
    database.close();
  });

  it("rolls back the whole clear when any checked candidate is not excluded", async () => {
    const { database } = createDatabase();
    await seedCandidate(database, "c1");
    await seedCandidate(database, "c2", { pool: "candidate" });

    const result = await createClear(database).execute({
      projectId: "p1",
      selected: [
        { candidateId: "c1", expectedUpdatedAt: excludedAt },
        { candidateId: "c2", expectedUpdatedAt: excludedAt },
      ],
      confirmedCount: 2,
    });

    expect(result).toEqual({ ok: false, error: "candidate-not-excluded" });
    await expectCandidateGraph(database, "c1", true);
    await expectCandidateGraph(database, "c2", true);
    database.close();
  });

  it("restores an excluded candidate to its recorded pool and keeps it after reopening", async () => {
    const { database, name } = createDatabase();
    await seedCandidate(database, "c1");

    const restored = await new RestoreExcludedCandidate(new DexieDecisionRepository(database), {
      now: () => restoredAt,
    }).execute({
      projectId: "p1",
      candidateId: "c1",
      expectedUpdatedAt: excludedAt,
    });

    expect(restored).toEqual({
      ok: true,
      value: {
        projectId: "p1",
        candidateId: "c1",
        pool: "selected",
        updatedAt: restoredAt,
      },
    });
    database.close();

    const reopened = new EryaDatabase(name);
    await expect(reopened.candidateDecisions.get("c1")).resolves.toEqual({
      projectId: "p1",
      candidateId: "c1",
      pool: "selected",
      updatedAt: restoredAt,
    });
    await expect(
      reopened.decisionHistory.where("candidateId").equals("c1").toArray(),
    ).resolves.toEqual([
      expect.objectContaining({ action: "exclude", from: "selected", to: "excluded" }),
      expect.objectContaining({
        action: "restore",
        from: "excluded",
        to: "selected",
        changedAt: restoredAt,
      }),
    ]);
    reopened.close();
  });
});
