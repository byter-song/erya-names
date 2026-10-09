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
      canProgress: async () => true,
    }).execute({ projectId: "p1", candidateId: "c1", to: "favorite" });

    expect(result).toMatchObject({ ok: true, value: { stage: "favorite" } });
    await expect(database.decisionHistory.toArray()).resolves.toEqual([
      expect.objectContaining({ candidateId: "c1", from: "inbox", to: "favorite" }),
    ]);
    database.close();
  });

  it("moves one name through basic, folklore and important stages with recoverable exclusion", async () => {
    const database = createDatabase();
    await database.projects.add({
      id: "p1",
      title: "宋姓宝宝起名",
      stage: "generation",
      status: "active",
      createdAt: "2026-09-18T00:00:00.000Z",
      updatedAt: "2026-09-18T00:00:00.000Z",
    });
    await database.candidateDecisions.add({
      projectId: "p1",
      candidateId: "c1",
      stage: "inbox",
      updatedAt: "2026-09-18T00:00:00.000Z",
    });
    let tick = 0;
    const useCase = new MoveCandidateDecision(new DexieDecisionRepository(database), {
      now: () => `2026-09-18T00:${String(++tick).padStart(2, "0")}:00.000Z`,
      canProgress: async () => true,
    });

    await expect(
      useCase.execute({ projectId: "p1", candidateId: "c1", to: "basic_shortlist" }),
    ).resolves.toMatchObject({ ok: true, value: { stage: "basic_shortlist" } });
    await expect(database.projects.get("p1")).resolves.toMatchObject({ stage: "funnel" });
    await expect(
      useCase.execute({ projectId: "p1", candidateId: "c1", to: "folklore_review" }),
    ).resolves.toMatchObject({ ok: true, value: { stage: "folklore_review" } });
    await expect(
      useCase.execute({ projectId: "p1", candidateId: "c1", to: "comparison" }),
    ).resolves.toMatchObject({
      ok: true,
      value: { stage: "comparison", folkloreReviewed: true },
    });
    await expect(database.projects.get("p1")).resolves.toMatchObject({ stage: "comparison" });
    await expect(
      useCase.execute({
        projectId: "p1",
        candidateId: "c1",
        to: "excluded",
        rejectionReason: "暂不考虑",
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { stage: "excluded", lastActiveStage: "comparison" },
    });
    await expect(database.projects.get("p1")).resolves.toMatchObject({ stage: "generation" });
    await expect(
      useCase.execute({ projectId: "p1", candidateId: "c1", to: "comparison" }),
    ).resolves.toMatchObject({ ok: true, value: { stage: "comparison" } });
    await expect(database.projects.get("p1")).resolves.toMatchObject({ stage: "comparison" });

    await expect(database.decisionHistory.count()).resolves.toBe(5);
    database.close();
  });

  it("enforces pending family rules inside the application use case", async () => {
    const database = createDatabase();
    await database.candidateDecisions.add({
      projectId: "p1",
      candidateId: "c1",
      stage: "basic_shortlist",
      updatedAt: "2026-09-18T00:00:00.000Z",
    });

    const result = await new MoveCandidateDecision(new DexieDecisionRepository(database), {
      now: () => "2026-09-18T00:10:00.000Z",
      canProgress: async () => false,
    }).execute({ projectId: "p1", candidateId: "c1", to: "comparison" });

    expect(result).toEqual({ ok: false, error: "family-rules-pending" });
    await expect(database.candidateDecisions.get("c1")).resolves.toMatchObject({
      stage: "basic_shortlist",
    });
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
      canProgress: async () => true,
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
      canProgress: async () => true,
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
      canProgress: async () => true,
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
      canProgress: async () => true,
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
