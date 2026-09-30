import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CreateComparisonSnapshot } from "../../src/application/use-cases/CreateComparisonSnapshot";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieComparisonRepository } from "../../src/infrastructure/repositories/DexieComparisonRepository";

const names = new Set<string>();
afterEach(async () => {
  await Promise.all([...names].map((name) => EryaDatabase.delete(name)));
  names.clear();
});

describe("CreateComparisonSnapshot", () => {
  it("enforces two-to-five candidates and persists an immutable snapshot", async () => {
    const name = `erya-comparison-${crypto.randomUUID()}`;
    names.add(name);
    const database = new EryaDatabase(name);
    await database.candidateDecisions.bulkAdd(
      ["c1", "c2"].map((candidateId) => ({
        projectId: "p1",
        candidateId,
        stage: "comparison",
        updatedAt: "2026-09-18T00:00:00.000Z",
      })),
    );
    const useCase = new CreateComparisonSnapshot(new DexieComparisonRepository(database), {
      createId: () => "snapshot-1",
      now: () => "2026-09-18T00:10:00.000Z",
    });
    const candidate = (id: string, rating: number) => ({
      id,
      fullName: id === "c1" ? "宋清扬" : "宋知远",
      pinyin: ["sòng"],
      sourceType: "verified_allusion" as const,
      summary: "快照释义",
      sourceEvidence: [{ sourceId: "shijing", work: "诗经", quote: "原文" }],
      warnings: [],
      ruleEvidence: [],
      rating,
      note: `第 ${rating} 轮评价`,
    });
    await expect(
      useCase.execute({ projectId: "p1", candidates: [candidate("c1", 3)] }),
    ).resolves.toEqual({
      ok: false,
      error: "comparison-requires-two-to-five-candidates",
    });
    await expect(
      useCase.execute({
        projectId: "p1",
        name: "第一轮",
        candidates: [candidate("c1", 3), candidate("c2", 4)],
      }),
    ).resolves.toMatchObject({ ok: true, value: { id: "snapshot-1" } });
    await expect(database.comparisonSnapshots.get("snapshot-1")).resolves.toMatchObject({
      candidateIds: ["c1", "c2"],
      name: "第一轮",
      candidates: [
        expect.objectContaining({ id: "c1", rating: 3, note: "第 3 轮评价" }),
        expect.objectContaining({ id: "c2", rating: 4, note: "第 4 轮评价" }),
      ],
    });
    await database.candidateEvaluations.put({
      projectId: "p1",
      candidateId: "c1",
      rating: 5,
      note: "后来修改",
      updatedAt: "2026-09-18T00:20:00.000Z",
    });
    const snapshots = await useCase.list("p1");
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.candidates[0]?.rating).toBe(3);
    database.close();
  });

  it("rejects moving a sixth candidate into the comparison pool", async () => {
    const name = `erya-comparison-${crypto.randomUUID()}`;
    names.add(name);
    const database = new EryaDatabase(name);
    await database.candidateDecisions.bulkAdd(
      ["c1", "c2", "c3", "c4", "c5"].map((candidateId) => ({
        projectId: "p1",
        candidateId,
        stage: "comparison",
        updatedAt: "2026-09-18T00:00:00.000Z",
      })),
    );
    await database.candidateDecisions.add({
      projectId: "p1",
      candidateId: "c6",
      stage: "inbox",
      updatedAt: "2026-09-18T00:00:00.000Z",
    });
    const result = await new (
      await import("../../src/application/use-cases/MoveCandidateDecision")
    ).MoveCandidateDecision(
      new (
        await import("../../src/infrastructure/repositories/DexieDecisionRepository")
      ).DexieDecisionRepository(database),
      { now: () => "2026-09-18T00:10:00.000Z" },
    ).execute({ projectId: "p1", candidateId: "c6", to: "comparison" });
    expect(result).toEqual({ ok: false, error: "comparison-pool-full" });
    database.close();
  });
});
