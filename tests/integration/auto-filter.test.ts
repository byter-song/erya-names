import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { ApplyCandidateAutoFilter } from "../../src/application/use-cases/ApplyCandidateAutoFilter";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieDecisionRepository } from "../../src/infrastructure/repositories/DexieDecisionRepository";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

function createDatabase(): EryaDatabase {
  const name = `erya-auto-filter-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

async function seed(database: EryaDatabase) {
  await database.projects.add({
    id: "p1",
    title: "宋姓宝宝起名",
    stage: "funnel",
    status: "active",
    createdAt: "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
  });
  await database.candidateDecisions.bulkAdd(
    ["c1", "c2"].map((candidateId) => ({
      projectId: "p1",
      candidateId,
      stage: "basic_shortlist" as const,
      updatedAt: "2026-10-08T00:00:00.000Z",
    })),
  );
}

describe("ApplyCandidateAutoFilter", () => {
  it("moves the confirmed preview in one transaction and records one batch", async () => {
    const database = createDatabase();
    await seed(database);
    const result = await new ApplyCandidateAutoFilter(new DexieDecisionRepository(database), {
      createBatchId: () => "auto-1",
      now: () => "2026-10-08T00:01:00.000Z",
    }).execute({
      projectId: "p1",
      moves: [
        {
          candidateId: "c2",
          from: "basic_shortlist",
          to: "inbox",
          expectedUpdatedAt: "2026-10-08T00:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual({ ok: true, value: { movedCandidateIds: ["c2"] } });
    await expect(database.candidateDecisions.get("c2")).resolves.toMatchObject({
      stage: "inbox",
      updatedAt: "2026-10-08T00:01:00.000Z",
    });
    await expect(database.decisionHistory.toArray()).resolves.toEqual([
      expect.objectContaining({
        action: "auto_filter_confirmed",
        batchId: "auto-1",
        candidateId: "c2",
      }),
    ]);
    database.close();
  });

  it("rolls back the whole preview when any candidate revision is stale", async () => {
    const database = createDatabase();
    await seed(database);
    const result = await new ApplyCandidateAutoFilter(new DexieDecisionRepository(database), {
      createBatchId: () => "auto-2",
      now: () => "2026-10-08T00:01:00.000Z",
    }).execute({
      projectId: "p1",
      moves: [
        {
          candidateId: "c1",
          from: "basic_shortlist",
          to: "inbox",
          expectedUpdatedAt: "2026-10-08T00:00:00.000Z",
        },
        {
          candidateId: "c2",
          from: "basic_shortlist",
          to: "inbox",
          expectedUpdatedAt: "stale",
        },
      ],
    });

    expect(result).toEqual({ ok: false, error: "auto-filter-preview-stale" });
    await expect(database.candidateDecisions.toArray()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateId: "c1", stage: "basic_shortlist" }),
        expect.objectContaining({ candidateId: "c2", stage: "basic_shortlist" }),
      ]),
    );
    await expect(database.decisionHistory.count()).resolves.toBe(0);
    database.close();
  });
});
