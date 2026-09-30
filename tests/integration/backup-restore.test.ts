import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { ImportProjectBackup } from "../../src/application/use-cases/ImportProjectBackup";
import { PreviewBackupImport } from "../../src/application/use-cases/PreviewBackupImport";
import { createBackupEnvelope } from "../../src/infrastructure/backup/backupSchema";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieBackupRepository } from "../../src/infrastructure/repositories/DexieBackupRepository";
import { namingProfileFixture } from "../fixtures/namingProfile";
import { namingProjectFixture } from "../fixtures/namingProject";

const databaseNames = new Set<string>();

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

async function backup(projectId = "project-song") {
  return createBackupEnvelope({
    appVersion: "0.2.0",
    datasetVersion: "dev-2026.09.17",
    rulePackVersion: "core-rules-1",
    exportedAt: "2026-09-17T10:00:00.000Z",
    payload: {
      projectId,
      projects: [namingProjectFixture(projectId)],
      profiles: [namingProfileFixture(projectId)],
      generationBatches: [],
      candidates: [],
      candidateSources: [],
      ruleResults: [],
      candidateDecisions: [],
      decisionHistory: [],
      candidateEvaluations: [],
      comparisonSnapshots: [],
      finalDecisions: [],
    },
  });
}

async function populatedBackup(projectId = "project-song") {
  const profile = namingProfileFixture(projectId);
  return createBackupEnvelope({
    appVersion: "0.2.0",
    datasetVersion: "dev-2026.09.17",
    rulePackVersion: "core-rules-1",
    exportedAt: "2026-09-17T10:00:00.000Z",
    payload: {
      projectId,
      projects: [
        {
          id: projectId,
          title: "宋姓宝宝起名",
          stage: "finalization",
          status: "completed",
          createdAt: "2026-09-17T00:00:00.000Z",
          updatedAt: "2026-09-17T09:00:00.000Z",
        },
      ],
      profiles: [profile],
      generationBatches: [
        {
          id: "batch-1",
          projectId,
          sequence: 1,
          seed: "seed",
          requestedCount: 1,
          profileSnapshot: profile,
          datasetVersion: "dev",
          rulePackVersion: "rules",
          status: "completed",
          statistics: {
            sourceCandidates: 1,
            hardRejected: 0,
            duplicateRejected: 0,
            historicalRejected: 0,
            persisted: 1,
          },
          createdAt: "2026-09-17T01:00:00.000Z",
        },
      ],
      candidates: [
        {
          id: "candidate-1",
          projectId,
          batchId: "batch-1",
          normalizedFingerprint: "宋清扬",
          surname: "宋",
          givenName: "清扬",
          fullName: "宋清扬",
          pinyin: ["sòng", "qīng", "yáng"],
          sourceType: "verified_allusion",
          summary: "清秀明朗",
          sourceIds: ["shijing"],
          sourceEvidence: [{ sourceId: "shijing", work: "诗经", quote: "有美一人" }],
          warnings: [],
          riskSignals: [],
          ruleResults: [],
          styleTags: [],
          characterElements: [],
          createdAt: "2026-09-17T01:00:00.000Z",
        },
        {
          id: "candidate-2",
          projectId,
          batchId: "batch-1",
          normalizedFingerprint: "宋知远",
          surname: "宋",
          givenName: "知远",
          fullName: "宋知远",
          pinyin: ["sòng", "zhī", "yuǎn"],
          sourceType: "verified_allusion",
          summary: "志向高远",
          sourceIds: [],
          sourceEvidence: [],
          warnings: [],
          riskSignals: [],
          ruleResults: [],
          styleTags: [],
          characterElements: [],
          createdAt: "2026-09-17T01:00:00.000Z",
        },
      ],
      candidateSources: [
        {
          id: "source-1",
          projectId,
          candidateId: "candidate-1",
          sourceId: "shijing",
          work: "诗经",
          quote: "有美一人",
        },
      ],
      ruleResults: [
        {
          id: "rule-1",
          projectId,
          candidateId: "candidate-1",
          evidenceLevel: "L1",
          outcome: "pass",
          ruleId: "l1-standard",
          ruleVersion: "1",
          explanation: "通过",
          sourceRefs: ["standard-hanzi-2013"],
        },
      ],
      candidateDecisions: [
        {
          projectId,
          candidateId: "candidate-1",
          stage: "finalist",
          updatedAt: "2026-09-17T02:00:00.000Z",
        },
      ],
      decisionHistory: [
        {
          projectId,
          candidateId: "candidate-1",
          from: "comparison",
          to: "finalist",
          changedAt: "2026-09-17T02:00:00.000Z",
        },
      ],
      candidateEvaluations: [
        {
          projectId,
          candidateId: "candidate-1",
          rating: 5,
          note: "喜欢",
          updatedAt: "2026-09-17T02:00:00.000Z",
        },
      ],
      comparisonSnapshots: [
        {
          id: "snapshot-1",
          projectId,
          name: "第一轮",
          candidateIds: ["candidate-1", "candidate-2"],
          candidates: [
            {
              id: "candidate-1",
              fullName: "宋清扬",
              pinyin: ["sòng", "qīng", "yáng"],
              sourceType: "verified_allusion",
              summary: "清秀明朗",
              sourceEvidence: [],
              warnings: [],
              ruleEvidence: [],
              rating: 5,
              note: "喜欢",
            },
            {
              id: "candidate-2",
              fullName: "宋知远",
              pinyin: ["sòng", "zhī", "yuǎn"],
              sourceType: "verified_allusion",
              summary: "志向高远",
              sourceEvidence: [],
              warnings: [],
              ruleEvidence: [],
            },
          ],
          createdAt: "2026-09-17T02:00:00.000Z",
        },
      ],
      finalDecisions: [
        {
          projectId,
          selectedCandidateId: "candidate-1",
          rationale: "喜欢",
          updatedAt: "2026-09-17T03:00:00.000Z",
        },
      ],
    },
  });
}

function createDatabase(): EryaDatabase {
  const name = `erya-restore-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

describe("backup restore", () => {
  it("previews a new project and an existing-project conflict without writing", async () => {
    const database = createDatabase();
    const repository = new DexieBackupRepository(database);
    const preview = new PreviewBackupImport(repository);
    const envelope = await backup();

    await expect(preview.execute(envelope)).resolves.toMatchObject({
      ok: true,
      value: { conflict: "none", projectId: "project-song", counts: { projects: 1 } },
    });
    expect(await database.projects.count()).toBe(0);

    await database.projects.add({
      id: "project-song",
      title: "当前方案",
      status: "active",
      updatedAt: "2026-09-17T09:00:00.000Z",
    });
    await expect(preview.execute(envelope)).resolves.toMatchObject({
      ok: true,
      value: { conflict: "project-id", projectId: "project-song" },
    });
    database.close();
  });

  it("requires an explicit conflict strategy and can import as a copy", async () => {
    const database = createDatabase();
    await database.projects.add({
      id: "project-song",
      title: "当前方案",
      status: "active",
      updatedAt: "2026-09-17T09:00:00.000Z",
    });
    const useCase = new ImportProjectBackup(new DexieBackupRepository(database), {
      createProjectId: () => "project-song-copy",
    });
    const envelope = await backup();

    await expect(useCase.execute({ envelope })).resolves.toEqual({
      ok: false,
      error: "conflict-strategy-required",
    });
    await expect(
      useCase.execute({ envelope, conflictStrategy: "import-copy" }),
    ).resolves.toMatchObject({ ok: true, value: { projectId: "project-song-copy" } });
    await expect(database.projects.get("project-song")).resolves.toMatchObject({
      title: "当前方案",
    });
    await expect(database.projects.get("project-song-copy")).resolves.toMatchObject({
      title: "宋姓宝宝起名（副本）",
    });
    database.close();
  });

  it("rolls back every write when restore fails inside the transaction", async () => {
    const database = createDatabase();
    await database.projects.add({
      id: "project-song",
      title: "当前方案",
      status: "active",
      updatedAt: "2026-09-17T09:00:00.000Z",
    });
    const repository = new DexieBackupRepository(database, {
      beforeWrite: () => {
        throw new Error("injected-write-failure");
      },
    });
    const result = await new ImportProjectBackup(repository, {
      createProjectId: () => "unused",
    }).execute({ envelope: await backup(), conflictStrategy: "replace" });

    expect(result).toEqual({ ok: false, error: "injected-write-failure" });
    await expect(database.projects.get("project-song")).resolves.toMatchObject({
      title: "当前方案",
    });
    database.close();
  });

  it("remaps every top-level and nested project/candidate reference for a copied import", async () => {
    const database = createDatabase();
    const result = await new ImportProjectBackup(new DexieBackupRepository(database), {
      createProjectId: () => "project-copy",
    }).execute({ envelope: await populatedBackup(), conflictStrategy: "import-copy" });

    expect(result).toMatchObject({ ok: true, value: { projectId: "project-copy" } });
    const batch = (await database.generationBatches.toArray())[0] as {
      profileSnapshot?: { projectId?: string };
    };
    const snapshot = (await database.comparisonSnapshots.toArray())[0];
    const copiedCandidates = await database.candidates.toArray();
    const copiedCandidate = copiedCandidates.find(
      (candidate) => candidate.fullName === "宋清扬",
    );
    expect(batch.profileSnapshot?.projectId).toBe("project-copy");
    expect(snapshot?.candidateIds).toHaveLength(2);
    expect(snapshot?.candidates.map((candidate) => candidate.id)).toEqual(
      snapshot?.candidateIds,
    );
    expect((await database.finalDecisions.toArray())[0]?.selectedCandidateId).toBe(
      copiedCandidate?.id,
    );
    database.close();
  });
});
