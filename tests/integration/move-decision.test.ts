import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { MoveCandidateDecision } from "../../src/application/use-cases/MoveCandidateDecision";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieDecisionRepository } from "../../src/infrastructure/repositories/DexieDecisionRepository";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

function createDatabase(): EryaDatabase {
  const name = `erya-decision-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

describe("MoveCandidateDecision", () => {
  it("persists the state transition and history together", async () => {
    const database = createDatabase();
    await database.candidateDecisions.add({
      projectId: "p1",
      candidateId: "c1",
      stage: "inbox",
      updatedAt: "2026-09-18T00:00:00.000Z",
    });

    const result = await new MoveCandidateDecision(new DexieDecisionRepository(database), {
      now: () => "2026-09-18T00:10:00.000Z",
    }).execute({ projectId: "p1", candidateId: "c1", to: "favorite" });

    expect(result).toMatchObject({ ok: true, value: { stage: "favorite" } });
    await expect(database.decisionHistory.toArray()).resolves.toEqual([
      expect.objectContaining({ candidateId: "c1", from: "inbox", to: "favorite" }),
    ]);
    database.close();
  });

  it("rejects a sixth finalist", async () => {
    const database = createDatabase();
    await database.candidateDecisions.bulkAdd([
      ...["c1", "c2", "c3", "c4", "c5"].map((candidateId) => ({
        projectId: "p1",
        candidateId,
        stage: "finalist" as const,
        updatedAt: "2026-09-18T00:00:00.000Z",
      })),
      {
        projectId: "p1",
        candidateId: "c6",
        stage: "comparison",
        updatedAt: "2026-09-18T00:00:00.000Z",
      },
    ]);

    const result = await new MoveCandidateDecision(new DexieDecisionRepository(database), {
      now: () => "2026-09-18T00:10:00.000Z",
    }).execute({ projectId: "p1", candidateId: "c6", to: "finalist" });

    expect(result).toEqual({ ok: false, error: "finalist-pool-full" });
    database.close();
  });

  it("rejects an excessively long rejection reason", async () => {
    const database = createDatabase();
    await database.candidateDecisions.add({
      projectId: "p1",
      candidateId: "c1",
      stage: "inbox",
      updatedAt: "2026-09-18T00:00:00.000Z",
    });

    const result = await new MoveCandidateDecision(new DexieDecisionRepository(database), {
      now: () => "2026-09-18T00:10:00.000Z",
    }).execute({
      projectId: "p1",
      candidateId: "c1",
      to: "rejected",
      rejectionReason: "太".repeat(501),
    });

    expect(result).toEqual({ ok: false, error: "rejection-reason-too-long" });
    database.close();
  });

  it("keeps the finalist limit under concurrent writes", async () => {
    const database = createDatabase();
    await database.candidateDecisions.bulkAdd([
      ...["c1", "c2", "c3", "c4"].map((candidateId) => ({
        projectId: "p1",
        candidateId,
        stage: "finalist" as const,
        updatedAt: "2026-09-18T00:00:00.000Z",
      })),
      ...["c5", "c6"].map((candidateId) => ({
        projectId: "p1",
        candidateId,
        stage: "comparison" as const,
        updatedAt: "2026-09-18T00:00:00.000Z",
      })),
    ]);
    const useCase = new MoveCandidateDecision(new DexieDecisionRepository(database), {
      now: () => "2026-09-18T00:10:00.000Z",
    });

    const results = await Promise.all(
      ["c5", "c6"].map((candidateId) =>
        useCase.execute({ projectId: "p1", candidateId, to: "finalist" }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(
      await database.candidateDecisions
        .where("[projectId+stage]")
        .equals(["p1", "finalist"])
        .count(),
    ).toBe(5);
    database.close();
  });

  it("invalidates a completed final decision when the finalist set changes", async () => {
    const database = createDatabase();
    await database.projects.add({
      id: "p1",
      title: "宋姓宝宝起名",
      stage: "finalization",
      status: "completed",
      createdAt: "2026-09-18T00:00:00.000Z",
      updatedAt: "2026-09-18T00:10:00.000Z",
    });
    await database.candidateDecisions.add({
      projectId: "p1",
      candidateId: "c1",
      stage: "finalist",
      updatedAt: "2026-09-18T00:00:00.000Z",
    });
    await database.finalDecisions.add({
      projectId: "p1",
      selectedCandidateId: "c1",
      rationale: "原决定",
      updatedAt: "2026-09-18T00:10:00.000Z",
    });

    const result = await new MoveCandidateDecision(new DexieDecisionRepository(database), {
      now: () => "2026-09-18T00:20:00.000Z",
    }).execute({ projectId: "p1", candidateId: "c1", to: "comparison" });

    expect(result.ok).toBe(true);
    expect(await database.finalDecisions.get("p1")).toBeUndefined();
    await expect(database.projects.get("p1")).resolves.toMatchObject({
      stage: "comparison",
      status: "active",
    });
    database.close();
  });
});
