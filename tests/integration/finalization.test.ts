import { seedDecisionWorkspace } from "../fixtures/decisionWorkspace";
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { FinalizeNamingDecision } from "../../src/application/use-cases/FinalizeNamingDecision";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieFinalDecisionRepository } from "../../src/infrastructure/repositories/DexieFinalDecisionRepository";
import { namingProjectFixture } from "../fixtures/namingProject";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

describe("FinalizeNamingDecision", () => {
  it("persists one selected name from three to five finalists", async () => {
    const name = `erya-final-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    const repository = new DexieFinalDecisionRepository(database);
    await database.projects.add(namingProjectFixture());
    await seedDecisionWorkspace(database, "project-song", [
      "candidate-1",
      "candidate-2",
      "candidate-3",
      "candidate-4",
    ]);
    await database.candidateDecisions.bulkAdd(
      ["candidate-1", "candidate-2", "candidate-3", "candidate-4"].map((candidateId) => ({
        projectId: "project-song",
        candidateId,
        stage: "finalist",
        updatedAt: "2026-09-17T03:00:00.000Z",
      })),
    );

    const result = await new FinalizeNamingDecision(repository, {
      now: () => "2026-09-17T03:10:00.000Z",
    }).execute({
      projectId: "project-song",
      selectedCandidateId: "candidate-2",
      rationale: "出处可信，读音清朗。",
    });

    expect(result.ok).toBe(true);
    await expect(database.finalDecisions.get("project-song")).resolves.toMatchObject({
      selectedCandidateId: "candidate-2",
      rationale: "出处可信，读音清朗。",
    });
    await expect(database.projects.get("project-song")).resolves.toMatchObject({
      stage: "finalization",
      status: "completed",
      updatedAt: "2026-09-17T03:10:00.000Z",
    });
    database.close();
  });

  it("requires between one and five finalists", async () => {
    const name = `erya-final-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    const result = await new FinalizeNamingDecision(
      new DexieFinalDecisionRepository(database),
      {
        now: () => "2026-09-17T03:10:00.000Z",
      },
    ).execute({
      projectId: "project-song",
      selectedCandidateId: "candidate-1",
      rationale: "测试",
    });

    expect(result).toEqual({ ok: false, error: "最终候选需要保持在 1 到 5 个" });
    database.close();
  });

  it("rechecks finalist membership inside the final write transaction", async () => {
    const name = `erya-final-${crypto.randomUUID()}`;
    databaseNames.add(name);
    const database = new EryaDatabase(name);
    await database.projects.add(namingProjectFixture());
    await seedDecisionWorkspace(database, "project-song", [
      "candidate-1",
      "candidate-2",
      "candidate-3",
      "candidate-4",
    ]);
    await database.candidateDecisions.bulkAdd(
      ["candidate-1", "candidate-2", "candidate-3", "candidate-4"].map((candidateId) => ({
        projectId: "project-song",
        candidateId,
        stage: "finalist" as const,
        updatedAt: "2026-09-17T03:00:00.000Z",
      })),
    );
    const repository = new DexieFinalDecisionRepository(database);
    const useCase = new FinalizeNamingDecision(repository, {
      now: () => "2026-09-17T03:10:00.000Z",
      beforeSave: async () => {
        await database.candidateDecisions.put({
          projectId: "project-song",
          candidateId: "candidate-1",
          stage: "comparison",
          updatedAt: "2026-09-17T03:05:00.000Z",
        });
      },
    });

    const result = await useCase.execute({
      projectId: "project-song",
      selectedCandidateId: "candidate-1",
      rationale: "测试",
    });
    expect(result).toEqual({ ok: false, error: "最终选择必须来自最终候选" });
    expect(await database.finalDecisions.count()).toBe(0);
    database.close();
  });
});
